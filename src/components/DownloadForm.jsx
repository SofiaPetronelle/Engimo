import { useState, useEffect } from 'react';
import { triggerDownload, getDownloadFiles } from '../api/github';

const DownloadForm = () => {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('download');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [existingFiles, setExistingFiles] = useState([]);
  const [newFiles, setNewFiles] = useState([]);

  useEffect(() => {
    const loadExistingFiles = async () => {
      try {
        const files = await getDownloadFiles();
        setExistingFiles(files);
      } catch (error) {
        console.warn('Unable to load existing download files:', error.message);
      }
    };
    loadExistingFiles();
  }, []);

  const normalizeUrls = (value) => value.split(/\s+/).filter(Boolean);

  const getNewFiles = (before, after) => {
    const beforeMap = new Map(before.map((file) => [file.path, file.sha]));
    return after.filter((file) => beforeMap.get(file.path) !== file.sha && !file.name.startsWith('.trigger'));
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitForNewRepoFiles = async (previousFiles) => {
    const maxTries = 24;
    for (let attempt = 0; attempt < maxTries; attempt += 1) {
      await sleep(5000);
      const latestFiles = await getDownloadFiles();
      const newFiles = getNewFiles(previousFiles, latestFiles);
      if (newFiles.length > 0) {
        setExistingFiles(latestFiles);
        return newFiles;
      }
    }
    throw new Error('فایل جدیدی پس از اتمام GitHub Actions یافت نشد.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    setNewFiles([]);
    const urls = normalizeUrls(text);

    if (!urls.length) {
      setStatus({ type: 'error', message: 'یک یا چند آدرس URL وارد کنید (با فاصله یا Enter جدا شوند).' });
      setLoading(false);
      return;
    }

    try {
      const urlStr = urls.join(' ');
      const previousFiles = existingFiles;
      await triggerDownload(urlStr, mode);
      setStatus({ type: 'info', message: 'در حال دانلود... منتظر بمانید تا فایل‌ها در مخزن ظاهر شوند...' });
      const newFiles = await waitForNewRepoFiles(previousFiles);
      setNewFiles(newFiles);
      setStatus({ type: 'success', message: `${newFiles.length} فایل جدید در مخزن یافت شد. لینک‌های دانلود در پایین.` });
      setText('');
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'خطا در دانلود فایل‌ها از مخزن.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (file) => {
    const link = document.createElement('a');
    link.href = file.download_url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="card mb-4">
      <h2 className="heading-medium">شروع دانلود</h2>
      <p className="text-muted mb-4">
        آدرس فایل‌ها را برای دانلود وارد کنید.
      </p>
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="آدرس‌ها را با فاصله یا Enter جدا کنید"
          className="textarea"
          rows="4"
        />
        <div className="flex" style={{ gap: '12px', alignItems: 'center' }}>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="select" style={{ marginBottom: 0, flex: '0 0 auto', width: 'auto', minWidth: '160px' }}>
            <option value="download">فایل‌های جداگانه</option>
            <option value="download-zip">فایل فشرده ZIP</option>
          </select>
          <button type="submit" className="button" disabled={loading} style={{ marginBottom: 0 }}>
            {loading ? 'در حال پردازش...' : 'دانلود'}
          </button>
        </div>
      </form>
      {status && (
        <div className={`mt-4 ${status.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {status.message}
        </div>
      )}
      {newFiles.length > 0 && (
        <div dir="ltr" className="mt-4" style={{ marginTop: '24px', padding: '20px', background: 'rgba(61, 180, 196, 0.08)', borderRadius: '12px' }}>
          <h3 className="heading-medium" style={{ marginTop: 0, textAlign: 'right' }}>فایل‌های آماده</h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {newFiles.map((file) => (
              <li key={file.sha} className="list-item flex justify-between align-center">
                <span>{file.name} ({Math.round(file.size / 1024)} KB)</span>
                <button onClick={() => handleDownload(file)} className="button" style={{ padding: '8px 16px' }}>
                  دریافت
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default DownloadForm;
