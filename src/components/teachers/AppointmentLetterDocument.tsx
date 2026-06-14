import React, { useState } from 'react';
import { formatDisplayDate } from '@/utils/dateFormat';
import { resolveLogoUrl } from '@/services/tenantService';
import { getTenantSchoolUrl } from '@/utils/tenantHost';
export type PortalAccessInfo = {
  username: string;
  temporaryPassword?: string;
  portalSlug?: string | null;
  tenantId?: number;
  portalUrl?: string;
  mustChangePassword?: boolean;
  instructions?: string;
};

export type AppointmentLetterData = {
  referenceNumber: string | null;
  versionNumber: number;
  generatedDate: string;
  letterDate?: string;
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string | null;
    initials?: string;
    portalSlug?: string | null;
    tenantId?: number;
  };
  teacher: {
    id?: number;
    fullName: string;
    staffId: string;
    photoUrl?: string | null;
    employmentDate: string;
    monthlySalary: number;
    className: string;
    subjects: string[];
  };
  positionTitle: string;
  department: string;
  employmentType: string;
  terms: {
    position: string;
    department: string;
    startDate: string;
    employmentType: string;
    probationPeriod: string;
    monthlySalary: number;
    workingHours: string;
    leaveEntitlement: string;
    noticePeriod: string;
  };
  bodyOpening: string;
  bodyClosing: string;
  portalAccess?: PortalAccessInfo;
  config: {
    signatoryName?: string;
    signatoryTitle?: string;
    workingHours?: string;
    leaveEntitlement?: string;
    noticePeriod?: string;
    probationPeriod?: string;
    customClauses?: string[];
    stampImage?: string | null;
  };
};

export function resolveLetterMediaUrl(url: string | null | undefined): string | null {
  return resolveLogoUrl(url || null);
}

export function schoolInitialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return 'SC';
}

export const APPOINTMENT_LETTER_PRINT_STYLES = `
@media print {
  @page { margin: 12mm; size: A4; }
  body * { visibility: hidden !important; }
  #appointment-letter-print-area,
  #appointment-letter-print-area * { visibility: visible !important; }
  #appointment-letter-print-area {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    background: white !important;
  }
  .appointment-letter-no-print { display: none !important; }
}
`;

function PortalAccessBlock({ data }: { data: AppointmentLetterData }) {
  const portal = data.portalAccess;
  const portalUrl =
    portal?.portalUrl ||
    getTenantSchoolUrl(portal?.portalSlug || data.school.portalSlug, portal?.tenantId || data.school.tenantId);

  if (!portal?.temporaryPassword) {
    return (
      <p style={{ margin: '0 0 16px', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
        Teacher portal login credentials will appear here after the letter is saved.
      </p>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        padding: '14px 16px',
        marginBottom: '16px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
      }}
    >
      <p
        style={{
          margin: '0 0 10px',
          fontWeight: 700,
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: NAVY,
        }}
      >
        Teacher Portal Access
      </p>
      {portal.instructions ? (
        <p style={{ margin: '0 0 10px', color: '#475569', lineHeight: 1.5 }}>{portal.instructions}</p>
      ) : null}
      <div style={{ display: 'grid', gap: '6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: '#475569' }}>Portal URL</span>
          <span style={{ color: '#0f172a', wordBreak: 'break-all' }}>{portalUrl || '—'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: '#475569' }}>Username (Staff ID)</span>
          <span style={{ color: '#0f172a', fontFamily: 'monospace' }}>{portal.username}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: '#475569' }}>Temporary Password</span>
          <span style={{ color: '#0f172a', fontFamily: 'monospace', fontWeight: 700 }}>{portal.temporaryPassword}</span>
        </div>
      </div>
      {portal.mustChangePassword ? (
        <p style={{ margin: '10px 0 0', color: '#b45309', fontWeight: 600 }}>
          Important: Change your password immediately after your first login.
        </p>
      ) : null}
    </div>
  );
}

const NAVY = '#1a3a5c';

type TermRow = { label: string; value: string };

function termRows(data: AppointmentLetterData): TermRow[] {
  const t = data.terms;
  return [
    { label: 'Position', value: t.position || data.positionTitle },
    { label: 'Department', value: t.department || data.department },
    { label: 'Start Date', value: formatDisplayDate(t.startDate || data.teacher.employmentDate) },
    { label: 'Employment Type', value: t.employmentType || data.employmentType },
    { label: 'Probation Period', value: t.probationPeriod || data.config.probationPeriod || '—' },
    { label: 'Monthly Salary', value: `GHS ${Number(t.monthlySalary || data.teacher.monthlySalary).toFixed(2)}` },
    { label: 'Working Hours', value: t.workingHours || data.config.workingHours || '—' },
    { label: 'Leave Entitlement', value: t.leaveEntitlement || data.config.leaveEntitlement || '—' },
    { label: 'Notice Period', value: t.noticePeriod || data.config.noticePeriod || '—' },
  ];
}

type Props = {
  data: AppointmentLetterData;
  id?: string;
  className?: string;
};

const AppointmentLetterDocument: React.FC<Props> = ({ data, id = 'appointment-letter-print-area', className = '' }) => {
  const logoSrc = resolveLetterMediaUrl(data.school.logoUrl);
  const [logoFailed, setLogoFailed] = useState(false);
  const initials = data.school.initials || schoolInitialsFromName(data.school.name);
  const letterDate = formatDisplayDate(data.letterDate || data.generatedDate);
  const contactLine = [data.school.phone, data.school.email].filter(Boolean).join(' · ');
  const refDisplay = data.referenceNumber || 'Pending';
  const showLogo = logoSrc && !logoFailed;

  return (
    <div
      id={id}
      className={`appointment-letter-doc bg-white text-slate-900 ${className}`}
      style={{ fontFamily: 'Georgia, "Times New Roman", serif', maxWidth: '210mm', margin: '0 auto' }}
    >
      <div style={{ height: '6px', backgroundColor: NAVY, width: '100%' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', padding: '24px 28px 16px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              color: NAVY,
              fontSize: '22px',
              fontWeight: 700,
              lineHeight: 1.2,
              margin: 0,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {data.school.name}
          </h1>
          {data.school.address ? (
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>{data.school.address}</p>
          ) : null}
          {contactLine ? (
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>{contactLine}</p>
          ) : null}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {showLogo ? (
            <img
              src={logoSrc}
              alt=""
              onError={() => setLogoFailed(true)}
              style={{ width: '64px', height: '64px', objectFit: 'contain', marginLeft: 'auto' }}
            />
          ) : (
            <div
              style={{
                width: '64px',
                height: '64px',
                backgroundColor: NAVY,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '18px',
                marginLeft: 'auto',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {initials}
            </div>
          )}
          <p style={{ margin: '8px 0 0', fontSize: '10px', color: '#94a3b8' }}>Ref: {refDisplay}</p>
        </div>
      </div>

      <div style={{ padding: '0 28px 28px', fontSize: '12px', lineHeight: 1.65, color: '#1e293b' }}>
        <p style={{ margin: '0 0 12px' }}>
          <strong>Date:</strong> {letterDate}
        </p>
        <p style={{ margin: '0 0 12px' }}>Dear {data.teacher.fullName},</p>
        <p style={{ margin: '0 0 16px', textAlign: 'justify' }}>{data.bodyOpening}</p>

        <div
          style={{
            borderLeft: `4px solid ${NAVY}`,
            paddingLeft: '12px',
            margin: '0 0 16px',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: NAVY,
          }}
        >
          Letter of Appointment — {data.positionTitle}
        </div>

        <div
          style={{
            backgroundColor: '#eef2f7',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '16px 18px',
            marginBottom: '16px',
          }}
        >
          <p
            style={{
              margin: '0 0 12px',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 700,
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: NAVY,
            }}
          >
            Terms &amp; Conditions
          </p>
          <div style={{ display: 'grid', gap: '8px' }}>
            {termRows(data).map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  gap: '12px',
                  fontSize: '11px',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                <span style={{ fontWeight: 600, color: '#475569' }}>{row.label}</span>
                <span style={{ color: '#0f172a' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {(data.config.customClauses || []).filter((c) => c.trim()).map((clause, idx) => (
          <p key={idx} style={{ margin: '0 0 10px', textAlign: 'justify' }}>
            {clause.trim()}
          </p>
        ))}

        <p style={{ margin: '0 0 16px', textAlign: 'justify' }}>{data.bodyClosing}</p>

        <PortalAccessBlock data={data} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '32px',
            marginTop: '8px',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '11px',
          }}
        >
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 700, color: NAVY }}>Employer</p>
            <p style={{ margin: '0 0 2px' }}>{data.config.signatoryName || '—'}</p>
            <p style={{ margin: '0 0 20px', color: '#64748b' }}>{data.config.signatoryTitle || '—'}</p>
            <div style={{ borderBottom: '1px solid #334155', height: '28px', marginBottom: '6px' }} />
            <p style={{ margin: 0, color: '#64748b' }}>Signature &nbsp;&nbsp; Date: _______________</p>
          </div>
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 700, color: NAVY }}>Employee</p>
            <p style={{ margin: '0 0 20px' }}>{data.teacher.fullName}</p>
            <div style={{ borderBottom: '1px solid #334155', height: '28px', marginBottom: '6px' }} />
            <p style={{ margin: 0, color: '#64748b' }}>Signature &nbsp;&nbsp; Date: _______________</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentLetterDocument;
