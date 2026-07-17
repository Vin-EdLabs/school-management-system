import { useEffect } from 'react';

/**
 * Sync native browser autofill into React controlled inputs.
 * Browsers fill the DOM value but skip React onChange — this hook bridges that gap.
 */
export function useBrowserAutofillSync(
  enabled: boolean,
  fieldId: string,
  onValue: (value: string) => void,
  options?: { focus?: boolean },
) {
  const focus = options?.focus !== false;

  useEffect(() => {
    if (!enabled) return;
    const el = document.getElementById(fieldId) as HTMLInputElement | null;
    if (!el) return;

    const sync = () => {
      const v = el.value?.trim();
      if (v) onValue(v);
    };

    el.addEventListener('change', sync);
    el.addEventListener('input', sync);
    const onAnim = (e: AnimationEvent) => {
      if (e.animationName === 'snp-autofill-start') sync();
    };
    el.addEventListener('animationstart', onAnim as EventListener);

    if (focus) {
      requestAnimationFrame(() => {
        el.focus({ preventScroll: true });
      });
    }

    const timers = [80, 250, 600].map((ms) => window.setTimeout(sync, ms));

    return () => {
      el.removeEventListener('change', sync);
      el.removeEventListener('input', sync);
      el.removeEventListener('animationstart', onAnim as EventListener);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [enabled, fieldId, onValue, focus]);
}

/** If the user signed in before, pre-fill email or phone from saved credentials. */
export function prefillIdentifierFromSaved(
  identifier: string,
): { email?: string; phone?: string } {
  const id = identifier.trim();
  if (!id) return {};
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) return { email: id };
  const digits = id.replace(/\D/g, '');
  if (digits.length >= 9) return { phone: id };
  return {};
}
