/** Split a full HTML document into preview markup (styles + body) and the original print string. */
export function parseFullPrintHtml(html: string) {
  if (!/<!DOCTYPE\s+html|<html[\s>]/i.test(html)) {
    return { previewHtml: html, printHtml: html };
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const styleBlocks = Array.from(doc.querySelectorAll('style'))
    .map((el) => el.textContent || '')
    .filter(Boolean)
    .join('\n');
  const bodyHtml = doc.body?.innerHTML || html;
  const previewHtml = styleBlocks ? `<style>${styleBlocks}</style>${bodyHtml}` : bodyHtml;
  return { previewHtml, printHtml: html };
}
