import React, { useState } from 'react';
import { resolveLogoUrl } from '@/services/tenantService';

export type AdmissionLetterData = {
  referenceNumber: string | null;
  versionNumber: number;
  student: {
    id: number;
    fullName: string;
    studentId: string;
    admissionNumber: string;
    className: string;
    admissionDate: string;
    photoUrl: string | null;
  };
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl: string | null;
  };
  bodyOpening: string;
  bodyClosing: string;
  clauses: string[];
  config: {
    signatoryName?: string;
    signatoryTitle?: string;
    signatureImage?: string | null;
    stampImage?: string | null;
  };
};

function resolveLetterMediaUrl(url: string | null | undefined): string | null {
  return resolveLogoUrl(url || null);
}

function schoolInitialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return 'SC';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-bold uppercase min-w-[130px] shrink-0">{label}</span>
      <div className="flex-grow min-w-0">
        <div className="font-extrabold uppercase pl-1" style={{ lineHeight: 1.5, paddingBottom: 3 }}>
          {value}
        </div>
        <div className="w-full" style={{ height: 1, backgroundColor: '#000' }} />
      </div>
    </div>
  );
}

type Props = {
  data: AdmissionLetterData;
  id?: string;
  className?: string;
  /** Off-screen PDF render — skip error fallbacks so embedded data URLs always display. */
  pdfMode?: boolean;
};

const AdmissionLetterDocument: React.FC<Props> = ({
  data,
  id = 'admission-letter-print-area',
  className = '',
  pdfMode = false,
}) => {
  const logoSrc = data.school.logoUrl?.startsWith('data:')
    ? data.school.logoUrl
    : resolveLetterMediaUrl(data.school.logoUrl);
  const [logoFailed, setLogoFailed] = useState(false);
  const initials = schoolInitialsFromName(data.school.name);
  const contactLine = [data.school.phone, data.school.email].filter(Boolean).join(' · ');
  const showLogo = Boolean(logoSrc) && (pdfMode || !logoFailed);

  const photoSrc = data.student.photoUrl?.startsWith('data:')
    ? data.student.photoUrl
    : resolveLetterMediaUrl(data.student.photoUrl);
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(photoSrc) && (pdfMode || !photoFailed);
  return (
    <div
      id={id}
      className={`admission-letter-doc bg-white text-slate-950 p-6 md:p-8 border-2 border-black rounded shadow-lg max-w-4xl mx-auto space-y-4 ${className}`}
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      {/* Header: Logo | School Name | Photo */}
      <table className="w-full border-collapse">
        <tbody>
          <tr className="border-none">
            <td className="w-20 align-middle border-none p-0">
              <div className="w-20 h-20 border-2 border-black overflow-hidden bg-slate-50">
                {showLogo ? (
                  <img
                    data-admission-letter-logo=""
                    src={logoSrc!}
                    alt=""
                    crossOrigin={logoSrc?.startsWith('data:') ? undefined : 'anonymous'}
                    onError={() => setLogoFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-300">{initials}</span>
                  </div>
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
            <td className="w-20 align-middle border-none p-0">
              <div className="w-20 h-20 border-2 border-black overflow-hidden bg-slate-50 ml-auto">
                {showPhoto ? (
                  <img
                    data-admission-letter-photo=""
                    src={photoSrc!}
                    alt=""
                    crossOrigin={photoSrc?.startsWith('data:') ? undefined : 'anonymous'}
                    onError={() => setPhotoFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-300">PHOTO</span>
                  </div>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Title Box */}
      <div className="border-2 border-black py-1 px-8 text-center font-bold tracking-widest text-base uppercase max-w-sm mx-auto">
        ADMISSION LETTER
      </div>

      {data.referenceNumber && (
        <p className="text-[9px] text-slate-500 font-bold text-center">Reference: {data.referenceNumber}</p>
      )}

      <p className="text-xs">Dear {data.student.fullName},</p>

      {/* Body Opening */}
      <p className="text-xs text-justify leading-relaxed">{data.bodyOpening}</p>

      {/* Student Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 text-xs">
        <DetailRow label="NAME:" value={data.student.fullName} />
        <DetailRow label="STUDENT ID:" value={data.student.studentId} />
        <DetailRow label="ADMISSION NO:" value={data.student.admissionNumber} />
        <DetailRow label="CLASS:" value={data.student.className} />
        <DetailRow label="DATE OF ADMISSION:" value={data.student.admissionDate} />
      </div>

      {/* Terms & Conditions */}
      {(data.clauses || []).length > 0 && (
        <div>
          <p className="font-bold uppercase text-xs tracking-wider mb-1">Terms &amp; Conditions of Admission</p>
          <ol className="list-decimal pl-5 text-xs space-y-1.5 text-justify leading-relaxed">
            {(data.clauses || []).filter(c => c.trim()).map((clause, idx) => (
              <li key={idx}>{clause.trim()}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Body Closing */}
      {data.bodyClosing ? (
        <p className="text-xs text-justify leading-relaxed">{data.bodyClosing}</p>
      ) : null}

      {/* Signatures Area */}
      <div className="flex flex-col items-center text-center text-xs mt-8 mb-4">
        <div className="w-full max-w-xs border-t border-black pt-1 font-bold uppercase text-[10px] tracking-wider mb-2">
          HEADMASTER / PRINCIPAL
        </div>
        <p className="font-bold">{data.config.signatoryName || '—'}</p>
        <p className="text-slate-500 text-[10px] mb-1">{data.config.signatoryTitle || '—'}</p>

        <div className="flex items-center justify-center gap-8 w-full max-w-sm">
          <div className="flex flex-col items-center flex-1">
            {data.config.signatureImage ? (
              <div className="my-1">
                <img src={data.config.signatureImage} alt="Signature" className="h-12 object-contain" />
              </div>
            ) : (
              <div className="h-10 w-full max-w-[140px] border-b border-black my-1" />
            )}
            <span className="text-[8px] text-slate-400 uppercase">Signature</span>
          </div>

          <div className="flex flex-col items-center flex-1">
            {data.config.stampImage ? (
              <div className="my-1">
                <img src={data.config.stampImage} alt="School Stamp" className="h-14 object-contain" />
              </div>
            ) : (
              <div className="h-3 my-1" />
            )}
            <span className="text-[8px] text-slate-400 uppercase">Stamp</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 pt-2 text-[8px] text-center text-slate-500 uppercase tracking-widest">
        Generated by ScholarNerve
      </div>
    </div>
  );
};

export default AdmissionLetterDocument;
