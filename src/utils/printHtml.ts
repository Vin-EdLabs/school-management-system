/** Print a full HTML document in a hidden iframe (same output users see in print dialog). */
export function printHtmlInHiddenIframe(html: string, title = 'Print'): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', title);
  iframe.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const runPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    }
  };

  const waitForImages = () =>
    Promise.all(
      Array.from(doc.images).map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) resolve();
            else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }
          })
      )
    ).then(() => window.setTimeout(runPrint, 200));

  if (doc.readyState === 'complete') {
    void waitForImages();
  } else {
    iframe.onload = () => void waitForImages();
  }
}
