import React from 'react';
import { Ban, School } from 'lucide-react';
import type { PublicErrorVariant } from '@/components/common/PublicErrorPage';

export type SchoolPortalErrorKind = 'deactivated' | 'not_found' | 'invalid' | 'network' | 'server' | 'unknown';

export type SchoolPortalErrorState = {
  kind: SchoolPortalErrorKind;
  message: string;
  schoolName?: string | null;
};

type TenantLookupPayload = {
  tenant?: { id?: number; name?: string };
  error?: string;
  code?: string;
  message?: string;
};

export function parseTenantLookup(
  status: number,
  payload: TenantLookupPayload
): { resolvedId: number | null; error: SchoolPortalErrorState | null } {
  const code = String(payload.code || '').toUpperCase();
  const apiMessage = String(payload.message || payload.error || '').trim();
  const schoolName = payload.tenant?.name ?? null;

  if (status === 403 || code === 'SCHOOL_DEACTIVATED' || /not active|deactivat/i.test(apiMessage)) {
    return {
      resolvedId: null,
      error: {
        kind: 'deactivated',
        message:
          apiMessage ||
          'This school account has been deactivated by ScholarNerve. Staff and parents cannot sign in until it is reactivated.',
        schoolName,
      },
    };
  }

  if (status === 404 || code === 'SCHOOL_NOT_FOUND' || code === 'SCHOOL_ARCHIVED') {
    return {
      resolvedId: null,
      error: {
        kind: 'not_found',
        message:
          apiMessage ||
          'No school matches this link. Check the spelling or ask your school for an updated portal link.',
        schoolName,
      },
    };
  }

  if (status >= 200 && status < 300 && payload.tenant?.id != null) {
    return { resolvedId: Number(payload.tenant.id), error: null };
  }

  return {
    resolvedId: null,
    error: {
      kind: status >= 500 ? 'server' : 'unknown',
      message: apiMessage || `Could not load this school (HTTP ${status}).`,
      schoolName,
    },
  };
}

export function schoolPortalErrorHidesLandingLink(_error: SchoolPortalErrorState): boolean {
  return true;
}

export function schoolPortalErrorPresentation(error: SchoolPortalErrorState): {
  variant: PublicErrorVariant;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
} {
  if (error.kind === 'deactivated') {
    return {
      variant: 'deactivated',
      eyebrow: 'Account deactivated',
      title: 'School account deactivated',
      description:
        error.message ||
        'ScholarNerve has deactivated this school account. Contact ScholarNerve support to request reactivation.',
      icon: <Ban className="h-5 w-5 text-amber-700" aria-hidden />,
    };
  }

  if (error.kind === 'not_found') {
    return {
      variant: 'not-found',
      eyebrow: 'Not found',
      title: 'School not found',
      description: error.message,
      icon: <School className="h-5 w-5 text-emerald-700" aria-hidden />,
    };
  }

  return {
    variant: 'default',
    eyebrow: 'Portal unavailable',
    title: 'School portal unavailable',
    description: error.message,
    icon: <School className="h-5 w-5 text-emerald-700" aria-hidden />,
  };
}
