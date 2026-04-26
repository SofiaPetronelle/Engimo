import { useState, useEffect } from 'react';
import { getWorkflowRuns } from '../api/github';

const statusBadge = (run) => {
  if (run.status === 'completed' && run.conclusion === 'success') {
    return <span className="badge green">موفق</span>;
  }
  if (run.status === 'completed') {
    return <span className="badge red">{run.conclusion || 'خطا'}</span>;
  }
  return <span className="badge yellow">در حال انجام</span>;
};

const ProgressTracker = () => {
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const data = await getWorkflowRuns();
        if (mounted) {
          setRuns(data);
          setError(null);
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError.message || 'خطا در دریافت اطلاعات.');
        }
      }
    };

    refresh();
    const interval = setInterval(refresh, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="card mb-4">
      <h2 className="heading-medium">پیشرفت کار</h2>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {runs.length === 0 ? (
        <p className="text-muted">هنوز هیچ فعالیتی انجام نشده است.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {runs.map((run) => (
            <li key={run.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
              <div className="flex" style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <a className="link" href={run.html_url} target="_blank" rel="noreferrer">
                  {run.name || run.workflow_id}
                </a>
                {statusBadge(run)}
              </div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>شاخه: {run.head_branch}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ProgressTracker;
