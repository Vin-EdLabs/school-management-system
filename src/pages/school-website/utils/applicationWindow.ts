export type ApplicationWindowReason = 'closed' | 'not_yet' | 'ended';

export type ApplicationWindowConfig = {
  applications_open?: boolean;
  open_date?: string | null;
  close_date?: string | null;
};

export function getApplicationWindowStatus(config: ApplicationWindowConfig): {
  open: boolean;
  reason?: ApplicationWindowReason;
  openDate?: string;
  closeDate?: string;
} {
  if (config.applications_open === false) {
    return { open: false, reason: 'closed' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const openDate = config.open_date ? String(config.open_date).slice(0, 10) : undefined;
  const closeDate = config.close_date ? String(config.close_date).slice(0, 10) : undefined;

  if (openDate && openDate > today) {
    return { open: false, reason: 'not_yet', openDate, closeDate };
  }
  if (closeDate && closeDate < today) {
    return { open: false, reason: 'ended', openDate, closeDate };
  }

  return { open: true, openDate, closeDate };
}
