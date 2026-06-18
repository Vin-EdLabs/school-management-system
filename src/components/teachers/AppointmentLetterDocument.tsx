import React, { useState, useRef, useEffect, useCallback } from 'react';
import { formatDisplayDate } from '@/utils/dateFormat';
import { resolveLogoUrl } from '@/services/tenantService';
import { getTenantSchoolUrl } from '@/utils/tenantHost';

import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import SignaturePad from '@/components/common/SignaturePad';

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
    signature?: string | null;
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
    signatureImage?: string | null;
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

export function printAppointmentLetter(elementId: string = 'appointment-letter-print-area') {
  const el = document.getElementById(elementId);
  if (!el) return;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.querySelectorAll('.no-print, button, [type="button"], input, [contenteditable]').forEach(el => el.remove());
  clone.querySelectorAll('.hidden').forEach(el => {
    (el as HTMLElement).style.display = 'inline';
    el.classList.remove('hidden');
  });
  clone.querySelectorAll('[style*="display: none"]').forEach(el => {
    (el as HTMLElement).style.display = '';
  });

  const headStylesheets = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
    .map(el => el.outerHTML)
    .join('\n');

  const win = window.open('', '_blank');
  if (!win) return;

  win.document.write(`
    <html>
      <head>
        <title>Appointment Letter</title>
        ${headStylesheets}
        <style>
          @page { margin: 5mm; size: A4 portrait; }
          @media print {
            body, body * { visibility: visible !important; }
            .no-print, .no-print *, button, button * { display: none !important; }
            body {
              margin: 0 !important; padding: 0 !important;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            color: #000; background: #fff; margin: 0; font-size: 13px;
          }
          table { width: 100%; border-collapse: collapse; }
          td, th { padding: 6px; vertical-align: middle; }
        </style>
      </head>
      <body>
        ${clone.outerHTML}
        <script>setTimeout(function(){window.print()},500)</script>
      </body>
    </html>
  `);
  win.document.close();
}

function PortalAccessBlock({ data }: { data: AppointmentLetterData }) {
  const portal = data.portalAccess;
  const portalUrl =
    portal?.portalUrl ||
    getTenantSchoolUrl(portal?.portalSlug || data.school.portalSlug, portal?.tenantId || data.school.tenantId);

  if (!portal?.temporaryPassword) {
    return (
      <p className="text-xs italic text-slate-500 mb-4">
        Teacher portal login credentials will appear here after the letter is saved.
      </p>
    );
  }

  return (
    <div className="border-2 border-black p-4 mb-4 space-y-2">
      <p className="font-bold uppercase text-xs tracking-wider mb-2">Teacher Portal Access</p>
      {portal.instructions ? (
        <p className="text-xs text-slate-700 mb-2">{portal.instructions}</p>
      ) : null}
      <div className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 text-xs">
        <span className="font-bold">Portal URL</span>
        <span className="underline break-all">{portalUrl || '—'}</span>
        <span className="font-bold">Username (Staff ID)</span>
        <span className="font-bold">{portal.username}</span>
        <span className="font-bold">Temporary Password</span>
        <span className="font-extrabold">{portal.temporaryPassword}</span>
      </div>
      {portal.mustChangePassword ? (
        <p className="text-xs font-bold text-red-700 mt-1">
          Important: Change your password immediately after your first login.
        </p>
      ) : null}
    </div>
  );
}

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

function todayString(): string {
  const d = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

type Props = {
  data: AppointmentLetterData;
  id?: string;
  className?: string;
  onChange?: (updates: Partial<AppointmentLetterData>) => void;
  userRole?: 'teacher' | 'admin' | 'super-admin' | string;
};

function signatureDateString(): string {
  const d = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

const AppointmentLetterDocument: React.FC<Props> = ({ data, id = 'appointment-letter-print-area', className = '', onChange, userRole }) => {
  const logoSrc = resolveLetterMediaUrl(data.school.logoUrl);
  const [logoFailed, setLogoFailed] = useState(false);
  const initials = data.school.initials || schoolInitialsFromName(data.school.name);
  const contactLine = [data.school.phone, data.school.email].filter(Boolean).join(' · ');
  const refDisplay = data.referenceNumber || 'Pending';
  const showLogo = logoSrc && !logoFailed;

  const [letterDateDraft, setLetterDateDraft] = useState(data.letterDate || todayString());
  const [sigDateDraft, setSigDateDraft] = useState(signatureDateString());
  const [employerSigImage, setEmployerSigImage] = useState<string>(data.config.signatureImage || '');
  const [stampImage, setStampImage] = useState<string>(data.config.stampImage || '');
  const [employeeSigImage, setEmployeeSigImage] = useState<string>(data.teacher.signature || '');
  const [isEmployerSigPadOpen, setIsEmployerSigPadOpen] = useState(false);
  const [isEmployeeSigPadOpen, setIsEmployeeSigPadOpen] = useState(false);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const empSigInputRef = useRef<HTMLInputElement>(null);
  const isTeacher = userRole === 'teacher';

  useEffect(() => {
    setLetterDateDraft(data.letterDate || todayString());
    setEmployerSigImage(data.config.signatureImage || '');
    setStampImage(data.config.stampImage || '');
    setEmployeeSigImage(data.teacher.signature || '');
  }, [data.letterDate, data.config.signatureImage, data.config.stampImage, data.teacher.signature]);

  const saveTeacherSig = useCallback(async (dataUrl: string) => {
    const teacherId = data.teacher.id;
    if (!teacherId) return;
    try {
      await apiService.put(`/teachers/${teacherId}/signature`, { signature: dataUrl });
    } catch {
      // silent — will still be in letter content
    }
  }, [data.teacher.id]);

  const emitChange = () => {
    onChange?.({
      letterDate: letterDateDraft,
      teacher: {
        ...data.teacher,
        signature: employeeSigImage || null,
      },
      config: {
        ...data.config,
        signatureImage: employerSigImage || null,
        stampImage: stampImage || null,
      },
    });
  };

  const setEmployeeSigAndSave = (dataUrl: string) => {
    setEmployeeSigImage(dataUrl);
    if (!onChange && dataUrl) saveTeacherSig(dataUrl);
  };

  const setEmpSigImage = (dataUrl: string) => {
    setEmployeeSigAndSave(dataUrl);
    emitChange();
  };

  return (
    <div
      id={id}
      className={`appointment-letter-doc bg-white text-slate-950 p-6 md:p-8 border-2 border-black rounded shadow-lg max-w-4xl mx-auto space-y-4 ${className}`}
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      {/* Header: Logo | School Name | Ref */}
      <table className="w-full border-collapse">
        <tbody>
          <tr className="border-none">
            <td className="w-20 align-middle border-none p-0">
              <div className="w-20 h-20 border-2 border-black inline-flex items-center justify-center overflow-hidden bg-slate-100">
                {showLogo ? (
                  <img
                    src={logoSrc}
                    alt=""
                    onError={() => setLogoFailed(true)}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">{initials}</span>
                )}
              </div>
            </td>
            <td className="text-center align-middle border-none px-4 p-0">
              <h1 className="text-2xl font-black uppercase tracking-normal m-0" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                {data.school.name}
              </h1>
              {data.school.address ? (
                <p className="text-xs text-slate-600 mt-1">{data.school.address}</p>
              ) : null}
              {contactLine ? (
                <p className="text-xs text-slate-600">{contactLine}</p>
              ) : null}
            </td>
            <td className="w-24 align-middle border-none text-right p-0">
              <p className="text-[9px] text-slate-500 font-bold">Ref: {refDisplay}</p>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Title Box */}
      <div className="border-2 border-black py-1 px-8 text-center font-bold tracking-widest text-base uppercase max-w-sm mx-auto">
        LETTER OF APPOINTMENT
      </div>

      <p className="text-xs">Dear {data.teacher.fullName},</p>

      {/* Body Opening */}
      <p className="text-xs text-justify leading-relaxed">{data.bodyOpening}</p>

      {/* Teacher Details & Position */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 text-xs">
        <div className="flex items-center">
          <span className="font-bold uppercase min-w-[130px]">NAME:</span>
          <span className="flex-grow border-b border-black font-extrabold pl-2 uppercase">{data.teacher.fullName}</span>
        </div>
        <div className="flex items-center">
          <span className="font-bold uppercase min-w-[130px]">STAFF ID:</span>
          <span className="flex-grow border-b border-black font-extrabold pl-2 uppercase">{data.teacher.staffId}</span>
        </div>
        <div className="flex items-center">
          <span className="font-bold uppercase min-w-[130px]">POSITION:</span>
          <span className="flex-grow border-b border-black font-extrabold pl-2 uppercase">{data.positionTitle}</span>
        </div>
        <div className="flex items-center">
          <span className="font-bold uppercase min-w-[130px]">DEPARTMENT:</span>
          <span className="flex-grow border-b border-black font-extrabold pl-2 uppercase">{data.department}</span>
        </div>
        <div className="flex items-center">
          <span className="font-bold uppercase min-w-[130px]">CLASS:</span>
          <span className="flex-grow border-b border-black font-extrabold pl-2 uppercase">{data.teacher.className}</span>
        </div>
        <div className="flex items-center">
          <span className="font-bold uppercase min-w-[130px]">EMPLOYMENT TYPE:</span>
          <span className="flex-grow border-b border-black font-extrabold pl-2 uppercase">{data.employmentType}</span>
        </div>
      </div>

      {/* Terms & Conditions Table */}
      <p className="font-bold uppercase text-xs tracking-wider mb-1">Terms &amp; Conditions of Appointment</p>
      <table className="w-full border-collapse text-xs border-all">
        <thead>
          <tr>
            <th className="border-2 border-black bg-slate-50 p-2 font-bold uppercase w-[140px] text-left">Term</th>
            <th className="border-2 border-black bg-slate-50 p-2 font-bold uppercase text-left">Details</th>
          </tr>
        </thead>
        <tbody>
          {termRows(data).map((row) => (
            <tr key={row.label}>
              <td className="border-2 border-black p-2 font-bold uppercase">{row.label}</td>
              <td className="border-2 border-black p-2 font-bold">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Custom Clauses */}
      {(data.config.customClauses || []).filter((c) => c.trim()).map((clause, idx) => (
        <p key={idx} className="text-xs text-justify leading-relaxed">{clause.trim()}</p>
      ))}

      {/* Body Closing */}
      <p className="text-xs text-justify leading-relaxed">{data.bodyClosing}</p>

      <PortalAccessBlock data={data} />

      {/* Subject List */}
      {data.teacher.subjects.length > 0 ? (
        <div className="flex items-start text-xs">
          <span className="font-bold uppercase min-w-[130px]">SUBJECT(S):</span>
          <span className="font-extrabold pl-2">{data.teacher.subjects.join(', ')}</span>
        </div>
      ) : null}

      {/* Signatures Area */}
      <div className="grid grid-cols-2 gap-8 mt-8 mb-4">
        {/* EMPLOYER Signature */}
        <div className="flex flex-col items-center text-center text-xs">
          <div className="w-full border-t border-black pt-1 font-bold uppercase text-[10px] tracking-wider mb-2">
            EMPLOYER
          </div>
          <p className="font-bold">{data.config.signatoryName || '—'}</p>
          <p className="text-slate-500 text-[10px] mb-1">{data.config.signatoryTitle || '—'}</p>

          {employerSigImage ? (
            <div className="relative group my-1">
              <img src={employerSigImage} alt="Employer Signature" className="h-12 object-contain" />
              {!isTeacher && (
                <button
                  onClick={() => { setEmployerSigImage(''); emitChange(); }}
                  className="absolute -top-3 -right-3 bg-red-100 text-red-600 rounded-full p-0.5 text-[8px] no-print hover:bg-red-200"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <div className="h-10 w-full max-w-[160px] border-b border-black my-1" />
          )}

          {stampImage ? (
            <div className="my-1">
              <img src={stampImage} alt="School Stamp" className="h-14 object-contain" />
            </div>
          ) : <div className="h-1 my-1" />}

          {!isTeacher && (
            <div className="flex flex-wrap gap-1 justify-center no-print mt-1">
              <button
                onClick={() => setIsEmployerSigPadOpen(true)}
                className="text-[9px] text-purple-600 hover:underline font-bold uppercase"
              >
                Draw Sign
              </button>
              <span className="text-[9px] text-slate-300">|</span>
              <label className="text-[9px] text-purple-600 hover:underline font-bold uppercase cursor-pointer">
                Upload Sign
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => { setEmployerSigImage(String(reader.result)); emitChange(); toast({ title: 'Signature uploaded' }); };
                  reader.readAsDataURL(file);
                }} />
              </label>
              <span className="text-[9px] text-slate-300">|</span>
              <label className="text-[9px] text-purple-600 hover:underline font-bold uppercase cursor-pointer">
                {stampImage ? 'Change' : 'Add'} Stamp
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => { setStampImage(String(reader.result)); emitChange(); toast({ title: 'Stamp uploaded' }); };
                  reader.readAsDataURL(file);
                }} />
              </label>
            </div>
          )}

          {/* Signature Date */}
          <div className="flex items-center gap-1 mt-2 w-full">
            <span className="font-bold uppercase text-[8px]">Date:</span>
            {isTeacher ? (
              <span className="flex-grow border-b border-black font-bold text-[8px] text-center">{sigDateDraft}</span>
            ) : (
              <>
                <input
                  type="text"
                  value={sigDateDraft}
                  onChange={(e) => setSigDateDraft(e.target.value)}
                  className="flex-grow border-b border-black font-bold bg-transparent focus:outline-none no-print text-[8px] text-center"
                />
                <span className="hidden print:inline flex-grow border-b border-black font-bold text-[8px] text-center">{sigDateDraft}</span>
              </>
            )}
          </div>
        </div>

        {/* EMPLOYEE Signature */}
        <div className="flex flex-col items-center text-center text-xs">
          <div className="w-full border-t border-black pt-1 font-bold uppercase text-[10px] tracking-wider mb-2">
            EMPLOYEE
          </div>
          <p className="font-bold">{data.teacher.fullName}</p>

          {employeeSigImage ? (
            <div className="relative group my-1">
              <img src={employeeSigImage} alt="Employee Signature" className="h-12 object-contain" />
              {isTeacher && (
                <button
                  onClick={() => { setEmployeeSigImage(''); emitChange(); if (!onChange) saveTeacherSig(''); }}
                  className="absolute -top-3 -right-3 bg-red-100 text-red-600 rounded-full p-0.5 text-[8px] no-print hover:bg-red-200"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <div className="h-10 w-full max-w-[160px] border-b border-black my-1" />
          )}

          {isTeacher && (
            <div className="flex flex-wrap gap-1 justify-center no-print mt-1">
              <button
                onClick={() => setIsEmployeeSigPadOpen(true)}
                className="text-[9px] text-purple-600 hover:underline font-bold uppercase"
              >
                Draw Sign
              </button>
              <span className="text-[9px] text-slate-300">|</span>
              <label className="text-[9px] text-purple-600 hover:underline font-bold uppercase cursor-pointer">
                Upload Sign
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => { setEmpSigImage(String(reader.result)); toast({ title: 'Signature uploaded' }); };
                  reader.readAsDataURL(file);
                }} />
              </label>
            </div>
          )}

          {/* Empty spacer to match employer stamp area height */}
          <div className={isTeacher ? 'h-1 my-1' : 'h-1 my-1'} />

          {/* Empty spacer to match employer buttons area height */}
          {!isTeacher && <div className="h-4 my-1 no-print" />}

          {/* Signature Date */}
          <div className="flex items-center gap-1 mt-2 w-full">
            <span className="font-bold uppercase text-[8px]">Date:</span>
            <span className="flex-grow border-b border-black font-bold text-[8px] text-center">{sigDateDraft}</span>
          </div>
        </div>
      </div>

      {/* Stamp display for print (below signatures) */}
      {stampImage && (
        <div className="hidden print:flex justify-center mt-2">
          <img src={stampImage} alt="School Stamp" className="h-16 object-contain" />
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-200 pt-2 text-[8px] text-center text-slate-500 uppercase tracking-widest">
        Generated by ScholarNerve
      </div>

      <SignaturePad
        open={isEmployerSigPadOpen}
        onOpenChange={setIsEmployerSigPadOpen}
        onSave={(dataUrl) => { setEmployerSigImage(dataUrl); emitChange(); }}
        title="Draw Employer Signature"
      />
      <SignaturePad
        open={isEmployeeSigPadOpen}
        onOpenChange={setIsEmployeeSigPadOpen}
        onSave={(dataUrl) => { setEmpSigImage(dataUrl); }}
        title="Draw Your Signature"
      />
    </div>
  );
};

export default AppointmentLetterDocument;
