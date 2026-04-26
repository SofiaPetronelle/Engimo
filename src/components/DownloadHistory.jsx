import { useState, useEffect } from 'react';
import { getDownloadFiles } from '../api/github';

const DownloadHistory = () => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchFiles = async () => {
      try {
        const data = await getDownloadFiles();
        if (mounted) {
          setFiles(data);
          setError(null);
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError.message || 'خطا در دریافت تاریخچه.');
        }
      }
    };
    fetchFiles();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDownload = (file) => {
    const link = document.createElement('a');
    link.href = file.download_url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="card mb-4" dir="ltr">
      <h2 className="heading-medium" style={{ textAlign: 'right' }}>تاریخچه دانلود</h2>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {files.length === 0 ? (
        <p className="text-muted">هنوز فایلی در مخزن ذخیره نشده است.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {files.map((file) => (
            <li key={file.sha} className="list-item flex justify-between align-center">
              <span>{file.name} ({Math.round(file.size / 1024)} KB)</span>
              <button onClick={() => handleDownload(file)} className="button" style={{ padding: '8px 16px' }}>
                دریافت
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default DownloadHistory;
