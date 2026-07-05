/** Collect linked + inline styles from the live page for print/preview fidelity. */
export function collectDocumentStyleMarkup(): string {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((el) => {
      const href = (el as HTMLLinkElement).href;
      if (!href) return '';
      return `<link rel="stylesheet" href="${href}" />`;
    })
    .filter(Boolean)
    .join('\n');

  const inline = Array.from(document.querySelectorAll('style'))
    .map((el) => `<style>${el.textContent || ''}</style>`)
    .join('\n');

  return `${links}\n${inline}`;
}

export function buildPrintDocumentFromHtml(bodyHtml: string, title: string, extraStyles = ''): string {
  const styles = collectDocumentStyleMarkup();
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${title}</title>${styles}${
    extraStyles ? `<style>${extraStyles}</style>` : ''
  }</head><body style="margin:0;padding:16px;background:#fff;color:#111;">${bodyHtml}</body></html>`;
}
