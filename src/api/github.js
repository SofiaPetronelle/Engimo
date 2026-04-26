import { Octokit } from '@octokit/rest';

const getStoredValue = (key) => {
  const value = localStorage.getItem(key);
  if (!value) {
    throw new Error(`Missing ${key}. Please set your GitHub token, owner, and repo on the home screen.`);
  }
  return value;
};

export const getOctokit = () => {
  const token = getStoredValue('github_token');
  return new Octokit({ auth: token });
};

export const getRepoConfig = () => ({
  owner: getStoredValue('github_owner'),
  repo: getStoredValue('github_repo'),
});

const getTriggerFileSha = async (octokit, owner, repo) => {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: 'downloads/.trigger',
    });
    return response.data.sha;
  } catch (error) {
    if (error.status === 404) {
      return undefined;
    }
    throw error;
  }
};

const encodeBase64 = (value) => btoa(unescape(encodeURIComponent(value)));

const workflowPath = '.github/workflows/download-with-aria2.yaml';
const workflowYaml = `name: Download from Commit & Save to Repo
on:
  push:
    branches:
      - "**"
jobs:
  save-file:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: \${{ secrets.GITHUB_TOKEN }}

      - name: Install aria2
        run: sudo apt-get install -y aria2

      - name: Extract URLs and download files
        run: |
          MSG=$(git log -1 --pretty=%B)
          echo "Commit message: $MSG"

          if echo "$MSG" | grep -qP 'download-zip:'; then
            MODE="zip"
            URL_LINE=$(echo "$MSG" | grep -oP 'download-zip:\s*\\K.*')
          elif echo "$MSG" | grep -qP 'download:'; then
            MODE="normal"
            URL_LINE=$(echo "$MSG" | grep -oP 'download:\s*\\K.*')
          else
            echo "❌ No download command found in commit message"
            exit 1
          fi

          echo "Mode: $MODE"
          mkdir -p downloads tmp_downloads

          for URL in $URL_LINE; do
            FILENAME=$(basename "$URL")
            echo "⬇️ Downloading $URL -> $FILENAME"

            aria2c \
              --split=2 \
              --max-connection-per-server=2 \
              --min-split-size=90M \
              --out="$FILENAME" \
              --dir="tmp_downloads" \
              "$URL"
          done

          if [ "$MODE" = "zip" ]; then
            ARCHIVE_NAME="tmp_downloads/archive_$(date +%Y%m%d_%H%M%S).zip"
            zip -j "$ARCHIVE_NAME" tmp_downloads/*
          fi

          for FILE in tmp_downloads/*; do
            [ -f "$FILE" ] || continue
            SIZE=$(stat -c%s "$FILE")
            LIMIT=$((90 * 1024 * 1024))
            BASENAME=$(basename "$FILE")

            if [ "$SIZE" -gt "$LIMIT" ]; then
              echo "✂️ $BASENAME is $(( SIZE / 1024 / 1024 ))MB — splitting with zip..."
              zip -s 90m "downloads/\${BASENAME}.zip" -j "$FILE"
              echo "✅ Parts: \$(ls downloads/\${BASENAME}* | wc -l)"
            else
              cp "$FILE" "downloads/$BASENAME"
            fi
          done

          rm -rf tmp_downloads

      - name: Commit & Push
        run: |
          BRANCH="\${GITHUB_REF_NAME}"
          git config user.name "github-actions"
          git config user.email "github-actions@github.com"
          git add downloads/
          git commit -m "Add downloaded files from commit [skip ci]" || echo "Nothing to commit"
          echo "🚀 Pushing to branch: $BRANCH"
          git push origin HEAD:$BRANCH
`;

export const ensureWorkflow = async (octokit, owner, repo) => {
  try {
    await octokit.repos.getContent({ owner, repo, path: workflowPath });
  } catch (error) {
    if (error.status === 404) {
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: workflowPath,
        message: 'Add download workflow [skip ci]',
        content: encodeBase64(workflowYaml),
      });
    } else {
      throw error;
    }
  }

  try {
    await octokit.rest.actions.setGithubActionsPermissionsRepository({
      owner,
      repo,
      enabled: true,
    });
  } catch (error) {
    console.warn('Could not enable Actions (may already be enabled):', error.message);
  }

  try {
    await octokit.rest.actions.setAllowedActionsRepository({
      owner,
      repo,
      allowed_actions: 'all',
    });
  } catch (error) {
    if (error.status !== 409) {
      console.warn('Could not set allowed actions repository settings:', error.message);
    }
  }
};

export const triggerDownload = async (urls, mode) => {
  const octokit = getOctokit();
  const { owner, repo } = getRepoConfig();
  await ensureWorkflow(octokit, owner, repo);
  const message = `${mode}: ${urls}`;
  const content = btoa('trigger');
  const sha = await getTriggerFileSha(octokit, owner, repo);

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: 'downloads/.trigger',
    message,
    content,
    sha,
  });
};

export const getWorkflowRuns = async () => {
  const octokit = getOctokit();
  const { owner, repo } = getRepoConfig();
  const response = await octokit.actions.listWorkflowRunsForRepo({
    owner,
    repo,
    per_page: 5,
  });
  return response.data.workflow_runs;
};

export const getDownloadFiles = async () => {
  const octokit = getOctokit();
  const { owner, repo } = getRepoConfig();
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: 'downloads',
    });
    if (!Array.isArray(response.data)) {
      return [];
    }
    return response.data.filter((item) => item.type === 'file');
  } catch (error) {
    if (error.status === 404) {
      return [];
    }
    throw error;
  }
};

export const downloadFilesFromRepo = (files) => {
  const results = { success: [], failed: [] };

  files.forEach((file) => {
    try {
      if (!file.download_url) {
        throw new Error('Missing download URL');
      }

      const link = document.createElement('a');
      link.href = file.download_url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      results.success.push(file.name);
    } catch (error) {
      results.failed.push({ file: file.name, error: error.message });
    }
  });

  return results;
};

export const getUser = async () => {
  const octokit = getOctokit();
  const response = await octokit.request('GET /user');
  return response.data;
};

export const forkSandbox = async () => {
  const octokit = getOctokit();
  const response = await octokit.request('POST /repos/maanimis/github-sandbox/forks', {});
  return response.data;
};

export const renameRepo = async (currentName, newName) => {
  const octokit = getOctokit();
  const user = await getUser();
  const response = await octokit.request('PATCH /repos/{owner}/{repo}', {
    owner: user.login,
    repo: currentName,
    name: newName,
  });
  return response.data;
};

export const makeRepoPrivate = async () => {
  const octokit = getOctokit();
  const { owner, repo } = getRepoConfig();
  const response = await octokit.request('PATCH /repos/{owner}/{repo}', {
    owner,
    repo,
    private: true,
  });
  return response.data;
};

export const isRepoFork = async () => {
  const octokit = getOctokit();
  const { owner, repo } = getRepoConfig();
  const response = await octokit.repos.get({ owner, repo });
  return response.data.fork;
};

export const getAllFiles = async (owner, repo, path = '') => {
  const octokit = getOctokit();
  const response = await octokit.repos.getContent({ owner, repo, path });
  let files = [];
  for (const item of response.data) {
    if (item.type === 'file' && item.path !== 'downloads/.trigger') {
      const fileResponse = await octokit.repos.getContent({ owner, repo, path: item.path });
      files.push({
        path: item.path,
        content: fileResponse.data.content,
        encoding: fileResponse.data.encoding,
      });
    } else if (item.type === 'dir') {
      files = files.concat(await getAllFiles(owner, repo, item.path));
    }
  }
  return files;
};

export const deleteRepo = async (owner, repo) => {
  const octokit = getOctokit();
  await octokit.repos.delete({ owner, repo });
};

export const createRepo = async (name, isPrivate = false) => {
  const octokit = getOctokit();
  const response = await octokit.repos.createForAuthenticatedUser({
    name,
    private: isPrivate,
  });
  return response.data;
};

export const addFilesToRepo = async (owner, repo, files) => {
  const octokit = getOctokit();
  for (const file of files) {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: file.path,
      message: 'Restore file',
      content: file.content,
      encoding: file.encoding,
    });
  }
};
