export const CLOSED_TERM_BROWSE_KEY = 'rosa-closed-term-browse';

export function getClosedTermBrowseLabel(): string | null {
  try {
    const v = sessionStorage.getItem(CLOSED_TERM_BROWSE_KEY);
    return v?.trim() ? v : null;
  } catch {
    return null;
  }
}

export function setClosedTermBrowseLabel(label: string | null): void {
  try {
    if (label?.trim()) {
      sessionStorage.setItem(CLOSED_TERM_BROWSE_KEY, label.trim());
    } else {
      sessionStorage.removeItem(CLOSED_TERM_BROWSE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function isClosedTermBrowseActive(): boolean {
  return !!getClosedTermBrowseLabel();
}
