import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { apiService } from '@/services/api';
import BulkPromoteStudents from './BulkPromoteStudents';

type HistoryRow = {
  id: string;
  studentName: string;
  studentNumber: string;
  fromClassName: string;
  toClassName: string;
  academicYear: string;
  promotedAt: string;
  actionType: string;
  promotedByName: string;
};

type PromotionsModuleProps = {
  embedded?: boolean;
  initialStudentId?: string | null;
  onConsumeInitialStudentId?: () => void;
};

const PromotionsModule: React.FC<PromotionsModuleProps> = ({
  embedded = false,
  initialStudentId = null,
  onConsumeInitialStudentId,
}) => {
  const [view, setView] = useState<'promote' | 'history'>('promote');
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const rows = await apiService.get<HistoryRow[]>('/promotions/history');
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'history') void loadHistory();
  }, [view, loadHistory]);

  if (view === 'history') {
    return (
      <div
        style={{
          maxWidth: embedded ? undefined : 1100,
          margin: embedded ? undefined : '0 auto',
          padding: embedded ? 0 : 32,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <button
          type="button"
          onClick={() => setView('promote')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 20,
            border: 'none',
            background: 'none',
            color: '#374151',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          <ArrowLeft size={16} /> Back to Promote
        </button>
        {!embedded && (
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: '0 0 8px' }}>Promotion History</h1>
        )}
        {embedded && (
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: '#111827' }}>Promotion History</h2>
        )}
        <p style={{ color: '#6b7280', marginBottom: 24 }}>Recent class promotions and graduations</p>

        {loadingHistory ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Loader2 className="animate-spin mx-auto" />
          </div>
        ) : history.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No promotion records yet.</p>
        ) : (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Student', 'From', 'To', 'Year', 'Date', 'By'].map((h) => (
                    <th key={h} style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600 }}>{row.studentName}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{row.studentNumber}</div>
                    </td>
                    <td style={{ padding: 12 }}>{row.fromClassName}</td>
                    <td style={{ padding: 12 }}>{row.toClassName}</td>
                    <td style={{ padding: 12 }}>{row.academicYear || '—'}</td>
                    <td style={{ padding: 12 }}>{new Date(row.promotedAt).toLocaleString()}</td>
                    <td style={{ padding: 12 }}>{row.promotedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <BulkPromoteStudents
      embedded={embedded}
      initialStudentId={initialStudentId}
      onConsumeInitialStudentId={onConsumeInitialStudentId}
      onViewHistory={() => setView('history')}
    />
  );
};

export default PromotionsModule;
