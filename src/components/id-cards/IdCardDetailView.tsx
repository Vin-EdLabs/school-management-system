import React, { useMemo, useState } from 'react';
import { ArrowLeft, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import type { IDCardSearchResult } from '@/types/idCard';
import type { CardEditorState } from './idCardExport';
import CardEditor from './CardEditor';
import CardExportButtons from './CardExportButtons';
import { resolveLogoUrl } from '@/services/tenantService';

export type CardMeta = {
  id?: number;
  status?: string;
  generatedAt?: string | null;
  generatedByName?: string | null;
};

export type LostReportRow = {
  id: string;
  reportedAt: string;
  status: string;
  message?: string | null;
};

export type EntityProfile = {
  dateOfBirth?: string | null;
  gender?: string | null;
  className?: string | null;
  department?: string | null;
  position?: string | null;
};

type IdCardDetailViewProps = {
  state: CardEditorState;
  meta?: IDCardSearchResult;
  cardMeta?: CardMeta;
  profile?: EntityProfile;
  lostReports?: LostReportRow[];
  primaryColor: string;
  editMode: boolean;
  editPanelOpen: boolean;
  exporting: boolean;
  exportAction: string | null;
  onBack: () => void;
  onSave: () => void;
  onReload: () => void;
  onToggleEdit: () => void;
  exportOptions: Parameters<typeof CardExportButtons>[0]['options'];
  onExporting: (exporting: boolean, action?: string) => void;
  onDataChange?: (data: import('@/types/idCard').IDCardData) => void;
};

const panel: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: '20px 24px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  transition: 'box-shadow 150ms ease',
};

function InfoRow({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f9fafb', gap: 12 }}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: accent || '#111',
          fontFamily: mono ? "'SF Mono', 'Fira Code', monospace" : undefined,
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 13 }}>
      <Inbox size={24} color="#d1d5db" style={{ margin: '0 auto 8px' }} />
      {message}
    </div>
  );
}

const IdCardDetailView: React.FC<IdCardDetailViewProps> = ({
  state,
  meta,
  cardMeta,
  profile,
  lostReports = [],
  primaryColor,
  editMode,
  editPanelOpen,
  exporting,
  exportAction,
  onBack,
  onSave,
  onReload,
  onToggleEdit,
  exportOptions,
  onExporting,
  onDataChange,
}) => {
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const isRevoked = cardMeta?.status === 'REVOKED';
  const isActive = cardMeta?.status === 'ACTIVE' || (!!cardMeta?.generatedAt && !isRevoked);
  const photo = resolveLogoUrl(state.data.photoBase64 || state.data.photoUrl) || undefined;

  const subtitle = [
    state.data.idNumber,
    state.entityType === 'STUDENT' ? 'Student' : 'Staff',
    meta?.className || profile?.className || meta?.department || profile?.department,
    state.data.academicYear,
  ].filter(Boolean).join(' · ');

  const exportOpts = useMemo(
    () => ({ ...exportOptions, onExporting }),
    [exportOptions, onExporting]
  );

  const revokeCard = async () => {
    setRevoking(true);
    try {
      await apiService.post('/id-cards/revoke', {
        entityType: state.entityType,
        entityId: state.entityId,
      });
      toast.success('Card revoked');
      setRevokeOpen(false);
      onReload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not revoke card');
    } finally {
      setRevoking(false);
    }
  };

  const reactivateCard = async () => {
    try {
      await apiService.post('/id-cards/reactivate', {
        entityType: state.entityType,
        entityId: state.entityId,
      });
      toast.success('Card reactivated');
      onReload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not reactivate card');
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', fontFamily: 'Inter, system-ui, sans-serif', background: '#f8f9fa', minHeight: '100%' }}>
      <button type="button" onClick={onBack} style={{ border: 'none', background: 'none', color: '#6b7280', fontSize: 14, cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
        <ArrowLeft size={16} /> ID Cards
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img
            src={photo}
            alt=""
            style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${primaryColor}`, background: '#f3f4f6' }}
          />
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0 }}>{state.data.fullName}</h1>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '6px 0 0' }}>{subtitle}</p>
            <span
              style={{
                display: 'inline-block',
                marginTop: 8,
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 99,
                background: isRevoked ? '#fef2f2' : isActive ? '#dcfce7' : '#f3f4f6',
                color: isRevoked ? '#dc2626' : isActive ? '#15803d' : '#6b7280',
              }}
            >
              {isRevoked ? '🔴 Revoked' : isActive ? '🟢 Active Card' : '⚪ Draft'}
            </span>
          </div>
        </div>
        {editMode && (
          <button type="button" onClick={onToggleEdit} style={{ height: 40, padding: '0 20px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 500, cursor: 'pointer' }}>
            {editPanelOpen ? 'Done Editing' : 'Edit Card'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 55%', minWidth: 320 }}>
          <div
            style={panel}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111', margin: 0 }}>ID Card Preview</h2>
            </div>

            {isRevoked && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16, textAlign: 'center', fontWeight: 500 }}>
                This card has been revoked
              </div>
            )}

            <div style={{ background: '#f8f9fa', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <CardEditor
                entityType={state.entityType}
                entityId={state.entityId}
                data={state.data}
                colors={state.colors}
                editMode={editPanelOpen && editMode}
                onChange={(data) => onDataChange?.(data)}
                scale={0.75}
                showVerifyUrl
              />
            </div>

            <CardExportButtons options={exportOpts} exporting={exporting} activeAction={exportAction} />
            {editMode && (
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={exporting}
                style={{
                  width: '100%',
                  marginTop: 12,
                  height: 44,
                  borderRadius: 10,
                  border: 'none',
                  background: primaryColor,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  opacity: exporting ? 0.6 : 1,
                }}
              >
                Generate &amp; Save
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: '1 1 40%', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={panel}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111', margin: '0 0 16px', paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>
              {state.entityType === 'STUDENT' ? 'Student Information' : 'Staff Information'}
            </h3>
            <InfoRow label="Full Name" value={state.data.fullName} />
            <InfoRow label={state.entityType === 'STUDENT' ? 'Student ID' : 'Staff ID'} value={state.data.idNumber} mono accent={primaryColor} />
            {state.entityType === 'STUDENT' && <InfoRow label="Class" value={meta?.className || profile?.className || '—'} />}
            {state.entityType === 'STUDENT' && <InfoRow label="Academic Year" value={state.data.academicYear || '—'} />}
            {state.entityType === 'STAFF' && <InfoRow label="Position" value={state.data.position || profile?.position || '—'} />}
            {state.entityType === 'STAFF' && <InfoRow label="Department" value={state.data.department || profile?.department || '—'} />}
            {profile?.dateOfBirth && <InfoRow label="Date of Birth" value={profile.dateOfBirth} />}
            {profile?.gender && <InfoRow label="Gender" value={profile.gender} />}
          </div>

          <div style={panel}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111', margin: '0 0 16px', paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>Card Status</h3>
            <InfoRow label="Status" value={isRevoked ? 'Revoked' : isActive ? 'Active' : 'Not generated'} />
            <InfoRow label="Generated" value={cardMeta?.generatedAt ? new Date(cardMeta.generatedAt).toLocaleString() : '—'} />
            <InfoRow label="Generated By" value={cardMeta?.generatedByName || '—'} />
            {cardMeta?.id != null && <InfoRow label="Card ID" value={`#GEN-${String(cardMeta.id).padStart(4, '0')}`} mono accent={primaryColor} />}
            {editMode && (
              <button
                type="button"
                onClick={() => (isRevoked ? void reactivateCard() : setRevokeOpen(true))}
                style={{
                  width: '100%',
                  marginTop: 12,
                  height: 40,
                  borderRadius: 10,
                  border: isRevoked ? '1px solid #bbf7d0' : '1px solid #fecaca',
                  background: isRevoked ? '#f0fdf4' : '#fef2f2',
                  color: isRevoked ? '#15803d' : '#dc2626',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {isRevoked ? 'Reactivate Card' : '🔒 Revoke This Card'}
              </button>
            )}
          </div>

          <div style={panel}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111', margin: '0 0 16px', paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>Scan History</h3>
            <EmptyPanel message="No scans recorded yet" />
          </div>

          <div style={panel}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111', margin: '0 0 16px', paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>Lost Card Reports</h3>
            {lostReports.length === 0 ? (
              <EmptyPanel message="No reports for this card" />
            ) : (
              lostReports.slice(0, 5).map((r) => (
                <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                  <div style={{ color: '#dc2626', fontWeight: 600 }}>🚨 {new Date(r.reportedAt).toLocaleString()} · {r.status}</div>
                  {r.message && <div style={{ color: '#6b7280', marginTop: 4 }}>{r.message}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {revokeOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>⚠️ Revoke this card?</h3>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, margin: '0 0 20px' }}>
              This will immediately invalidate <strong>{state.data.idNumber}</strong>. Anyone scanning the QR code will see &quot;INVALID CARD&quot;. You can generate a new card later.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setRevokeOpen(false)} style={{ flex: 1, height: 40, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={revoking} onClick={() => void revokeCard()} style={{ flex: 1, height: 40, borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {revoking ? 'Revoking…' : 'Yes, Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IdCardDetailView;
