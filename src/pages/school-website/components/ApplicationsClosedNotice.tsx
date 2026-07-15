import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Lock, Mail, Phone } from 'lucide-react';
import { formatDisplayDate } from '@/utils/dateFormat';
import type { ApplicationWindowReason } from '../utils/applicationWindow';

type Props = {
  kind: 'admissions' | 'careers';
  reason: ApplicationWindowReason;
  openDate?: string;
  closeDate?: string;
  contact?: {
    primary_phone?: string | null;
    secondary_phone?: string | null;
    email?: string | null;
  };
};

const COPY: Record<
  ApplicationWindowReason,
  { title: string; admissions: string; careers: string }
> = {
  closed: {
    title: 'Applications are currently closed',
    admissions:
      'We are not accepting new student applications online at this time. You can still reach our admissions office using the contact details below.',
    careers:
      'We are not accepting new employment applications online at this time. Please check back later or contact the school office directly.',
  },
  not_yet: {
    title: 'Applications have not opened yet',
    admissions:
      'Online admissions will open on the date shown below. We look forward to receiving your application when the window opens.',
    careers:
      'Online career applications will open on the date shown below. Please return when applications are open.',
  },
  ended: {
    title: 'The application period has ended',
    admissions:
      'The deadline for online admissions has passed. Contact the school office if you need assistance or wish to enquire about late applications.',
    careers:
      'The current recruitment window has closed. Contact the school office if you would like to express interest for future openings.',
  },
};

export default function ApplicationsClosedNotice({
  kind,
  reason,
  openDate,
  closeDate,
  contact = {},
}: Props) {
  const copy = COPY[reason];
  const phone = contact.primary_phone || contact.secondary_phone;
  const email = contact.email;

  return (
    <div className="sw-closed-notice">
      <div className="sw-closed-notice-icon" aria-hidden>
        {reason === 'closed' ? <Lock className="h-7 w-7" /> : <CalendarClock className="h-7 w-7" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="sw-eyebrow !text-[var(--sw-gold)]">{kind === 'admissions' ? 'Admissions' : 'Careers'}</p>
        <h2 className="sw-serif mt-2 text-2xl leading-tight md:text-3xl">{copy.title}</h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed md:text-base" style={{ color: 'var(--sw-muted)' }}>
          {kind === 'admissions' ? copy.admissions : copy.careers}
        </p>

        {(openDate || closeDate) && (
          <div className="mt-6 flex flex-wrap gap-3">
            {openDate && reason === 'not_yet' && (
              <span className="sw-closed-notice-pill">
                Opens {formatDisplayDate(openDate)}
              </span>
            )}
            {closeDate && reason !== 'not_yet' && (
              <span className="sw-closed-notice-pill">
                Closed {formatDisplayDate(closeDate)}
              </span>
            )}
            {openDate && closeDate && reason === 'ended' && (
              <span className="sw-closed-notice-pill sw-closed-notice-pill--muted">
                Window: {formatDisplayDate(openDate)} – {formatDisplayDate(closeDate)}
              </span>
            )}
          </div>
        )}

        {(phone || email) && (
          <div className="mt-8 rounded-xl border border-[var(--sw-border)] bg-white/80 p-5">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--sw-primary)' }}>
              Need help?
            </p>
            <div className="mt-3 flex flex-col gap-2.5 text-sm">
              {phone && (
                <a href={`tel:${String(phone).replace(/\s/g, '')}`} className="sw-closed-notice-link">
                  <Phone className="h-4 w-4 shrink-0" style={{ color: 'var(--sw-gold)' }} />
                  {String(phone)}
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="sw-closed-notice-link">
                  <Mail className="h-4 w-4 shrink-0" style={{ color: 'var(--sw-gold)' }} />
                  {String(email)}
                </a>
              )}
            </div>
          </div>
        )}

        <div className="mt-6">
          <Link to="/contact" className="sw-btn sw-btn-outline inline-flex gap-2">
            Contact the school
          </Link>
        </div>
      </div>
    </div>
  );
}
