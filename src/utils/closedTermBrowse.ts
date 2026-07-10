export const CLOSED_TERM_BROWSE_KEY = 'rosa-closed-term-browse';

export type ClosedTermBrowseState = {
  label: string;
  ledgerTermId: number | null;
};

type Listener = (state: ClosedTermBrowseState | null) => void;

const listeners = new Set<Listener>();

function notify(state: ClosedTermBrowseState | null) {
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch {
      /* ignore */
    }
  });
}

function parseStored(raw: string | null): ClosedTermBrowseState | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ClosedTermBrowseState> | string;
    if (typeof parsed === 'string') {
      const label = parsed.trim();
      return label ? { label, ledgerTermId: null } : null;
    }
    const label = String(parsed?.label || '').trim();
    if (!label) return null;
    const id =
      parsed?.ledgerTermId != null && !Number.isNaN(Number(parsed.ledgerTermId))
        ? Number(parsed.ledgerTermId)
        : null;
    return { label, ledgerTermId: id };
  } catch {
    // Legacy: plain label string
    const label = raw.trim();
    return label ? { label, ledgerTermId: null } : null;
  }
}

export function getClosedTermBrowse(): ClosedTermBrowseState | null {
  try {
    return parseStored(sessionStorage.getItem(CLOSED_TERM_BROWSE_KEY));
  } catch {
    return null;
  }
}

/** @deprecated Prefer getClosedTermBrowse().label */
export function getClosedTermBrowseLabel(): string | null {
  return getClosedTermBrowse()?.label ?? null;
}

export function setClosedTermBrowse(state: ClosedTermBrowseState | null): void {
  try {
    if (state?.label?.trim()) {
      const next: ClosedTermBrowseState = {
        label: state.label.trim(),
        ledgerTermId:
          state.ledgerTermId != null && !Number.isNaN(Number(state.ledgerTermId))
            ? Number(state.ledgerTermId)
            : null,
      };
      sessionStorage.setItem(CLOSED_TERM_BROWSE_KEY, JSON.stringify(next));
      notify(next);
    } else {
      sessionStorage.removeItem(CLOSED_TERM_BROWSE_KEY);
      notify(null);
    }
  } catch {
    /* ignore */
  }
}

/** @deprecated Prefer setClosedTermBrowse */
export function setClosedTermBrowseLabel(label: string | null): void {
  if (label?.trim()) {
    const existing = getClosedTermBrowse();
    setClosedTermBrowse({
      label: label.trim(),
      ledgerTermId: existing?.ledgerTermId ?? null,
    });
  } else {
    setClosedTermBrowse(null);
  }
}

export function isClosedTermBrowseActive(): boolean {
  return !!getClosedTermBrowse()?.label;
}

export function subscribeClosedTermBrowse(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
