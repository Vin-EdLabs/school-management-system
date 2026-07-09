/**
 * Cross-browser page zoom estimation for desktop nudges.
 * Conservative by default: avoids false "100%" readings (common in Firefox/Edge).
 */

const INCH_BASE_PX = 96;
const MM100_BASE_PX = 377.9527559055118; // 100mm at 96dpi

let inchProbe: HTMLDivElement | null = null;
let mmProbe: HTMLDivElement | null = null;

export type ZoomReading = {
  source: 'inch' | 'mm' | 'maxViewport' | 'screenInner' | 'outerInner' | 'visualViewport';
  percent: number;
};

function ensureInchProbe(): HTMLDivElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  if (!inchProbe) {
    inchProbe = document.createElement('div');
    inchProbe.style.cssText =
      'position:fixed;left:-10000px;top:0;width:1in;height:1in;visibility:hidden;pointer-events:none;margin:0;padding:0;border:0;';
    document.body.appendChild(inchProbe);
  }
  return inchProbe;
}

function ensureMmProbe(): HTMLDivElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  if (!mmProbe) {
    mmProbe = document.createElement('div');
    mmProbe.style.cssText =
      'position:fixed;left:-10000px;top:0;width:100mm;height:100mm;visibility:hidden;pointer-events:none;margin:0;padding:0;border:0;';
    document.body.appendChild(mmProbe);
  }
  return mmProbe;
}

function readInchZoomPercent(): number | null {
  const el = ensureInchProbe();
  if (!el) return null;
  const px = el.getBoundingClientRect().width;
  if (!px) return null;
  return Math.round((px / INCH_BASE_PX) * 100);
}

function readMmZoomPercent(): number | null {
  const el = ensureMmProbe();
  if (!el) return null;
  const px = el.getBoundingClientRect().width;
  if (!px) return null;
  return Math.round((px / MM100_BASE_PX) * 100);
}

function readMaximizedViewportZoomPercent(): number | null {
  if (typeof window === 'undefined') return null;
  const screenW = window.screen?.availWidth ?? 0;
  const innerW = window.innerWidth;
  const outerW = window.outerWidth;
  if (!screenW || !innerW || !outerW) return null;
  if (outerW < screenW * 0.88) return null;
  return Math.round((screenW / innerW) * 100);
}

function readScreenInnerZoomPercent(): number | null {
  if (typeof window === 'undefined') return null;
  const screenW = Math.max(window.screen?.availWidth ?? 0, window.screen?.width ?? 0);
  const innerW = window.innerWidth;
  const outerW = window.outerWidth;
  if (!screenW || !innerW || !outerW) return null;
  if (outerW < screenW * 0.72) return null;
  return Math.round((screenW / innerW) * 100);
}

function readOuterInnerZoomPercent(): number | null {
  if (typeof window === 'undefined' || !window.innerWidth) return null;
  const ratio = window.outerWidth / window.innerWidth;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return Math.round(ratio * 100);
}

function readVisualViewportZoomPercent(): number | null {
  if (typeof window === 'undefined') return null;
  const vv = window.visualViewport;
  if (!vv?.width) return null;
  const scale = vv.scale ?? 1;
  if (scale < 0.5 || scale > 4) return null;
  const layoutRatio = window.innerWidth / vv.width;
  if (!Number.isFinite(layoutRatio) || layoutRatio <= 0) return null;
  return Math.round(layoutRatio * scale * 100);
}

/** Viewport wider than the screen — typical when zoomed out below 100%. */
export function isZoomedOutBelow100(): boolean {
  if (typeof window === 'undefined') return false;
  const screenW = window.screen?.availWidth ?? window.screen?.width ?? 0;
  if (!screenW) return false;
  return window.innerWidth > screenW * 1.03;
}

export function collectZoomReadings(): ZoomReading[] {
  const readings: ZoomReading[] = [];

  const inch = readInchZoomPercent();
  if (inch != null) readings.push({ source: 'inch', percent: inch });

  const mm = readMmZoomPercent();
  if (mm != null) readings.push({ source: 'mm', percent: mm });

  const maxVp = readMaximizedViewportZoomPercent();
  if (maxVp != null) readings.push({ source: 'maxViewport', percent: maxVp });

  const screenInner = readScreenInnerZoomPercent();
  if (screenInner != null) readings.push({ source: 'screenInner', percent: screenInner });

  const outerInner = readOuterInnerZoomPercent();
  if (outerInner != null) readings.push({ source: 'outerInner', percent: outerInner });

  const visual = readVisualViewportZoomPercent();
  if (visual != null) readings.push({ source: 'visualViewport', percent: visual });

  return readings;
}

export function readBrowserZoomPercent(): number | null {
  const readings = collectZoomReadings();
  if (readings.length === 0) return null;

  if (isZoomedOutBelow100()) {
    const layout = readings.filter((r) => r.source !== 'inch' && r.source !== 'mm');
    if (layout.length > 0) {
      return Math.min(...layout.map((r) => r.percent));
    }
  }

  const trusted = readings.filter((r) => r.source !== 'inch' && r.source !== 'mm');
  if (trusted.length > 0) {
    const minTrusted = Math.min(...trusted.map((r) => r.percent));
    const inch = readings.find((r) => r.source === 'inch')?.percent;
    if (inch != null && inch - minTrusted > 12) return minTrusted;
    return Math.round(trusted.reduce((sum, r) => sum + r.percent, 0) / trusted.length);
  }

  const percents = readings.map((r) => r.percent);
  return Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length);
}

/** Any strong signal that zoom is below ~96% (e.g. 70%, 80%, 90%). */
export function isClearlyBelow100(): boolean {
  if (isZoomedOutBelow100()) return true;

  const readings = collectZoomReadings();
  if (readings.some((r) => r.percent < 96)) return true;

  const layout = readings.filter((r) => r.source !== 'inch' && r.source !== 'mm');
  if (layout.some((r) => r.percent < 96)) return true;

  return false;
}

/** 100% or zoomed in above 100%. Requires corroboration — inch/mm alone is not enough. */
export function isTriggerZoom(): boolean {
  const readings = collectZoomReadings();
  if (readings.length === 0) return false;

  const percents = readings.map((r) => r.percent);

  if (percents.some((p) => p < 96)) return false;
  if (isZoomedOutBelow100()) return false;

  const trustedAt100 = readings.filter(
    (r) => r.source !== 'inch' && r.source !== 'mm' && r.percent >= 99,
  );
  if (trustedAt100.length > 0) return true;

  const atOrAbove100 = readings.filter((r) => r.percent >= 99);
  if (atOrAbove100.length >= 2) return true;

  // Single physical-unit probe reporting 100% is unreliable in Firefox/Edge.
  return false;
}

/** User zoomed out to ~80% or ~90%. */
export function isComfortableZoom(): boolean {
  if (isZoomedOutBelow100()) {
    const zoom = readBrowserZoomPercent();
    if (zoom == null) return true;
    return zoom <= 93;
  }

  const readings = collectZoomReadings();
  if (readings.some((r) => r.percent >= 75 && r.percent <= 93)) return true;

  const zoom = readBrowserZoomPercent();
  if (zoom == null) return false;
  return zoom >= 75 && zoom <= 93;
}

/** Fresh login: show when at 100%+; hide when clearly already at 70–90%. */
export function shouldShowOnLogin(): boolean {
  if (isComfortableZoom() || isClearlyBelow100()) return false;
  return isTriggerZoom();
}
