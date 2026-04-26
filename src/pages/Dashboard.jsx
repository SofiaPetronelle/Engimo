import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DownloadForm from '../components/DownloadForm';
import ProgressTracker from '../components/ProgressTracker';
import DownloadHistory from '../components/DownloadHistory';
import { makeRepoPrivate, isRepoFork, getAllFiles, deleteRepo, createRepo, addFilesToRepo, ensureWorkflow, getRepoConfig, getOctokit } from '../api/github';

const Dashboard = () => {
  const [owner, setOwner] = useState(localStorage.getItem('github_owner') || '');
  const [repo, setRepo] = useState(localStorage.getItem('github_repo') || '');
  const [token, setToken] = useState(localStorage.getItem('github_token'));
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token || !owner || !repo) {
      navigate('/');
    }
  }, [token, owner, repo, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_owner');
    localStorage.removeItem('github_repo');
    navigate('/');
  };

  const handleSaveSettings = (event) => {
    event.preventDefault();
    localStorage.setItem('github_owner', owner.trim());
    localStorage.setItem('github_repo', repo.trim());
    setMessage('تنظیمات مخزن با موفقیت ذخیره شد.');
  };

  const handleMakePrivate = async () => {
    try {
      const { owner, repo } = getRepoConfig();
      const isFork = await isRepoFork();
      if (isFork) {
        // Leave the fork network: delete the fork and recreate as private
        setMessage('در حال خروج از شبکه fork...');
        const files = await getAllFiles(owner, repo);
        await deleteRepo(owner, repo);
        await createRepo(repo, true);
        await addFilesToRepo(owner, repo, files);
        // Recreate workflow
        const octokit = getOctokit();
        await ensureWorkflow(octokit, owner, repo);
        setMessage('مخزن با موفقیت خصوصی شد.');
      } else {
        await makeRepoPrivate();
        setMessage('مخزن با موفقیت خصوصی شد.');
      }
    } catch (error) {
      setMessage('خطا: ' + error.message);
    }
  };

  return (
    <div className="container">
      <header className="flex justify-between align-center mb-4">
        <div>
          <h1 className="heading-large">Engimo</h1>
          <p className="text-muted">{owner}/{repo}</p>
        </div>
        <button onClick={handleLogout} className="button secondary">
          خروج
        </button>
      </header>

      <div className="card mb-4">
        <h2 className="heading-medium">تنظیمات مخزن</h2>
        <form onSubmit={handleSaveSettings}>
          <label>نام کاربری</label>
          <input value={owner} onChange={(e) => setOwner(e.target.value)} className="input" />
          <label>نام مخزن</label>
          <input value={repo} onChange={(e) => setRepo(e.target.value)} className="input" />
          <div className="flex" style={{ gap: '12px' }}>
            <button className="button" type="submit">
              ذخیره تنظیمات
            </button>
            <button onClick={handleMakePrivate} className="button secondary" type="button">
              مخفی کردن
            </button>
          </div>
        </form>
        {message && <div className="text-green-600 mt-4">{message}</div>}
      </div>

      <DownloadForm />
      <ProgressTracker />
      <DownloadHistory />
    </div>
  );
};

export default Dashboard;
