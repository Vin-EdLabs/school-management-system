import React, { useEffect, useState } from 'react';
import { Search, IdCard } from 'lucide-react';
import { apiService } from '@/services/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { CardEntityType, IDCardSearchResult } from '@/types/idCard';
import IdCardDetailView from './IdCardDetailView';
import { useCardLoader, useDebouncedValue, useCardExporting } from './idCardExport';
import { resolveLogoUrl } from '@/services/tenantService';

type IdCardsModuleProps = {
  onNavigate?: (module: string) => void;
};

const panelStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const IdCardsModule: React.FC<IdCardsModuleProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'administrator' || user?.role === 'super-admin';
  const [tab, setTab] = useState<'students' | 'staff'>('students');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = useState<IDCardSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<{
    entityType: CardEntityType;
    entityId: number;
    staffType?: string;
    meta?: IDCardSearchResult;
  } | null>(null);
  const [editPanelOpen, setEditPanelOpen] = useState(false);

  const { state, setState, loading: cardLoading, reload } = useCardLoader(
    selected?.entityType || null,
    selected?.entityId || null,
    selected?.staffType
  );

  const { exporting, exportAction, setExporting } = useCardExporting();

  const primaryColor = state?.colors.primaryColor || '#1a3a6b';

  useEffect(() => {
    if (!isAdmin && user?.role === 'teacher') {
      setTab('staff');
      void apiService
        .get<IDCardSearchResult[]>('/id-cards/search?type=staff&q=')
        .then((rows) => {
          if (rows[0]) {
            setSelected({
              entityType: 'STAFF',
              entityId: rows[0].id,
              staffType: rows[0].staffType || 'teacher',
              meta: rows[0],
            });
          }
        })
        .catch(() => undefined);
    }
  }, [isAdmin, user?.role]);

  useEffect(() => {
    if (!isAdmin && user?.role === 'teacher') return;
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    const type = tab === 'staff' ? 'staff' : 'student';
    setSearching(true);
    void apiService
      .get<IDCardSearchResult[]>(`/id-cards/search?type=${type}&q=${encodeURIComponent(debouncedQuery)}`)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [debouncedQuery, tab, isAdmin, user?.role]);

  const openEditor = (entityType: CardEntityType, row: IDCardSearchResult) => {
    setSelected({
      entityType,
      entityId: row.id,
      staffType: row.staffType,
      meta: row,
    });
    setEditPanelOpen(false);
  };

  const saveCard = async () => {
    if (!state) return;
    try {
      await apiService.post('/id-cards/generate', {
        entityType: state.entityType,
        entityId: state.entityId,
        staffType: state.staffType,
        cardData: {
          academicYear: state.data.academicYear,
          position: state.data.position,
          department: state.data.department,
        },
      });
      await reload();
      if (selected?.meta) {
        setSelected({ ...selected, meta: { ...selected.meta, hasGeneratedCard: true } });
      }
      toast.success('Card saved with the latest configuration');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save card');
    }
  };

  if (selected && cardLoading) {
    return <p style={{ padding: 32, color: '#6b7280' }}>Loading card…</p>;
  }

  if (selected && state) {
    const editMode = !state.readOnly;
    const exportOptions = {
      entityType: state.entityType,
      data: state.data,
      colors: state.colors,
      fullName: state.data.fullName,
    };

    return (
      <IdCardDetailView
        state={state}
        meta={selected.meta}
        cardMeta={state.cardMeta ?? undefined}
        profile={state.profile}
        lostReports={state.lostReports}
        primaryColor={primaryColor}
        editMode={editMode}
        editPanelOpen={editPanelOpen}
        exporting={exporting}
        exportAction={exportAction}
        onBack={() => setSelected(null)}
        onSave={saveCard}
        onReload={() => void reload()}
        onToggleEdit={() => setEditPanelOpen((v) => !v)}
        exportOptions={exportOptions}
        onExporting={setExporting}
        onDataChange={(data) => setState({ ...state, data })}
      />
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 32, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: '#111827', margin: 0 }}>ID Cards</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>Generate and manage student and staff identity cards</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => onNavigate?.('id-card-settings')}
            style={{ height: 40, padding: '0 20px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer' }}
          >
            Card Configuration →
          </button>
        )}
      </div>

      <div style={{ display: 'inline-flex', border: '1px solid #e5e7eb', borderRadius: 99, padding: 3, marginBottom: 24, background: '#fff' }}>
        {(['students', 'staff'] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setQuery(''); setResults([]); }}
              style={{
                border: 'none',
                borderRadius: 99,
                padding: '8px 24px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                background: active ? primaryColor : 'transparent',
                color: active ? '#fff' : '#6b7280',
                transition: 'all 150ms ease',
              }}
            >
              {t === 'students' ? 'Student' : 'Staff'}
            </button>
          );
        })}
      </div>

      <div style={{ position: 'relative', marginBottom: 24 }}>
        <Search size={18} style={{ position: 'absolute', left: 14, top: 13, color: '#9ca3af' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or ID number..."
          style={{
            width: '100%',
            height: 44,
            paddingLeft: 42,
            paddingRight: 16,
            fontSize: 14,
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            boxSizing: 'border-box',
            outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = primaryColor; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
        />
      </div>

      {!query.trim() && (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <IdCard size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: 12, color: '#9ca3af' }}>Search for a student or staff member to generate their ID card</p>
        </div>
      )}

      {query.trim() && !searching && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 24px' }}>
          <p style={{ fontSize: 14, color: '#374151' }}>No results found for &quot;{query}&quot;</p>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Try searching by full name or ID number</p>
        </div>
      )}

      {query.trim() && results.length > 0 && (
        <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontWeight: 500, color: '#6b7280', fontSize: 12 }}>Photo</th>
                <th style={{ padding: '12px 16px', fontWeight: 500, color: '#6b7280', fontSize: 12 }}>Name</th>
                <th style={{ padding: '12px 16px', fontWeight: 500, color: '#6b7280', fontSize: 12 }}>{tab === 'students' ? 'Class' : 'Department'}</th>
                <th style={{ padding: '12px 16px', fontWeight: 500, color: '#6b7280', fontSize: 12 }}>Last Card</th>
                <th style={{ padding: '12px 16px', fontWeight: 500, color: '#6b7280', fontSize: 12 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr
                  key={`${tab}-${row.id}`}
                  style={{ borderBottom: '1px solid #f3f4f6' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <img
                      src={resolveLogoUrl(row.photoUrl) || undefined}
                      alt=""
                      style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb', background: '#f3f4f6' }}
                    />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 500, color: '#111' }}>{row.fullName}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{row.idNumber}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>
                    {tab === 'students' ? row.className || '—' : row.department || row.position || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {row.hasGeneratedCard ? (
                      <>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#047857', background: '#ecfdf5', padding: '2px 8px', borderRadius: 99 }}>Active</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 99 }}>Not generated</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => openEditor(tab === 'students' ? 'STUDENT' : 'STAFF', row)}
                        style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: primaryColor, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                      >
                        Generate Card
                      </button>
                      {row.hasGeneratedCard && (
                        <button
                          type="button"
                          onClick={() => openEditor(tab === 'students' ? 'STUDENT' : 'STAFF', row)}
                          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}
                        >
                          View Card
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default IdCardsModule;
