import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOctokit, forkSandbox, renameRepo } from '../api/github';

const Home = () => {
  const [token, setToken] = useState(localStorage.getItem('github_token') || '');
  const [owner, setOwner] = useState(localStorage.getItem('github_owner') || '');
  const [repo, setRepo] = useState(localStorage.getItem('github_repo') || '');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedToken = localStorage.getItem('github_token');
    const storedOwner = localStorage.getItem('github_owner');
    const storedRepo = localStorage.getItem('github_repo');

    if (storedToken && storedOwner && storedRepo) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token || !owner || !repo) {
      setError('توکن گیت‌هاب، نام کاربری و نام مخزن الزامی هستند.');
      return;
    }

    localStorage.setItem('github_token', token.trim());
    localStorage.setItem('github_owner', owner.trim());
    localStorage.setItem('github_repo', repo.trim());

    try {
      const octokit = getOctokit();
      await octokit.repos.get({ owner: owner.trim(), repo: repo.trim() });
    } catch (error) {
      if (error.status === 404) {
        setError('مخزن پیدا نشد. در حال ساخت مخزن...');
        try {
          await forkSandbox();
          await new Promise(resolve => setTimeout(resolve, 3000));
          if (repo.trim() !== 'github-sandbox') {
            await renameRepo('github-sandbox', repo.trim());
          }
          setError(null);
        } catch (forkError) {
          setError('خطا در ساخت مخزن: ' + forkError.message);
          return;
        }
      } else {
        setError('خطا در بررسی مخزن: ' + error.message);
        return;
      }
    }

    navigate('/dashboard');
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 520, margin: '60px auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 className="heading-large" style={{ fontSize: '2.5rem' }}>Engimo</h1>
          <p className="text-muted">دانلود فایل با گیت‌هاب</p>
        </div>
        <p className="text-muted mb-4" style={{ textAlign: 'center' }}>
          اطلاعات گیت‌هاب خود را وارد کنید تا فایل‌ها را دانلود کنید.
        </p>
        <form onSubmit={handleSubmit}>
          <label>توکن گیت‌هاب (GitHub Token)</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_..."
            className="input"
            type="password"
          />
          <label>نام کاربری گیت‌هاب</label>
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="your-github-username"
            className="input"
          />
          <label>نام مخزن (Repository)</label>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="my-downloads"
            className="input"
          />
          {error && <div className="text-red-600 mb-4">{error}</div>}
          <button type="submit" className="button" style={{ width: '100%', marginTop: '8px' }}>
            ذخیره و ادامه
          </button>
        </form>
      </div>
    </div>
  );
};

export default Home;
