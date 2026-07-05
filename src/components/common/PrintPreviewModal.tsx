import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { buildPrintDocumentFromHtml } from '../../utils/collectDocumentStyles';
import { printHtmlInHiddenIframe } from '../../utils/printHtml';

type PrintPreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  html?: string;
  printDocumentHtml?: string;
  contentRef?: React.RefObject<HTMLElement | null>;
  contentElement?: HTMLElement | null;
  printStyles?: string;
  isFullDocument?: boolean;
};

function prepareCloneForPreview(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.remove('max-md:hidden', 'md:hidden', 'hidden', 'sr-only');
  clone.style.removeProperty('display');
  clone.style.removeProperty('position');
  clone.style.removeProperty('left');
  clone.style.removeProperty('opacity');
  clone.style.removeProperty('pointer-events');
  clone.style.removeProperty('transform');
  clone.style.removeProperty('transform-origin');
  clone.style.removeProperty('margin-bottom');
  clone.style.width = 'max-content';
  clone.style.minWidth = '100%';
  clone.style.maxWidth = 'none';
  clone.querySelectorAll('.student-photo-print').forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });
  return clone;
}

const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  open,
  onOpenChange,
  title = 'Preview',
  html,
  printDocumentHtml,
  contentRef,
  contentElement,
  printStyles = '',
  isFullDocument = false,
}) => {
  const [iframeHeight, setIframeHeight] = useState(600);
  const [previewDocHtml, setPreviewDocHtml] = useState('');
  const [fragmentHtml, setFragmentHtml] = useState('');
  const cloneContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fullDocForPreview = isFullDocument ? (html || printDocumentHtml || '') : '';
  const hasDomSource = Boolean(contentRef || contentElement) && !fullDocForPreview;
  /** Use document HTML directly in iframe — do not wait for useEffect (avoids blank first paint). */
  const iframeSrcDoc = fullDocForPreview || previewDocHtml;

  const syncClonePreview = useCallback(() => {
    const el = contentRef?.current ?? contentElement;
    const container = cloneContainerRef.current;
    if (!el || !container) return false;
    container.innerHTML = '';
    container.appendChild(prepareCloneForPreview(el));
    return true;
  }, [contentRef, contentElement]);

  useEffect(() => {
    if (!open) {
      setPreviewDocHtml('');
      setFragmentHtml('');
      setIframeHeight(600);
      if (cloneContainerRef.current) cloneContainerRef.current.innerHTML = '';
      return;
    }

    if (fullDocForPreview) {
      setPreviewDocHtml(fullDocForPreview);
      setFragmentHtml('');
      return;
    }

    if (html && !hasDomSource) {
      setFragmentHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ''));
      setPreviewDocHtml('');
      return;
    }

    setPreviewDocHtml('');
    setFragmentHtml('');
  }, [open, html, fullDocForPreview, hasDomSource]);

  useLayoutEffect(() => {
    if (!open || !hasDomSource) return;

    const trySync = () => syncClonePreview();

    if (trySync()) return;

    const raf = requestAnimationFrame(() => {
      if (trySync()) return;
      window.setTimeout(() => {
        trySync();
        window.setTimeout(trySync, 150);
      }, 50);
    });
    return () => cancelAnimationFrame(raf);
  }, [open, hasDomSource, syncClonePreview, contentRef, contentElement, html, printDocumentHtml]);

  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;
    const height = Math.max(
      doc.documentElement?.scrollHeight || 0,
      doc.body?.scrollHeight || 0,
      400
    );
    setIframeHeight(height + 24);
  }, []);

  useEffect(() => {
    if (!open || !fullDocForPreview) return;
    const t = window.setTimeout(resizeIframe, 150);
    const t2 = window.setTimeout(resizeIframe, 600);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [open, fullDocForPreview, resizeIframe]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const resolvePrintDocumentHtml = useCallback((): string | null => {
    if (printDocumentHtml?.trim()) return printDocumentHtml;
    if (fullDocForPreview?.trim()) return fullDocForPreview;

    const el = contentRef?.current ?? contentElement;
    if (el?.innerHTML?.trim()) {
      return buildPrintDocumentFromHtml(el.innerHTML, title, printStyles);
    }

    if (fragmentHtml?.trim()) {
      return buildPrintDocumentFromHtml(fragmentHtml, title, printStyles);
    }

    const cloneEl = cloneContainerRef.current?.firstElementChild as HTMLElement | null;
    if (cloneEl?.innerHTML?.trim()) {
      return buildPrintDocumentFromHtml(cloneEl.innerHTML, title, printStyles);
    }

    return null;
  }, [
    printDocumentHtml,
    fullDocForPreview,
    contentRef,
    contentElement,
    fragmentHtml,
    title,
    printStyles,
  ]);

  const handlePrint = useCallback(() => {
    const doc = resolvePrintDocumentHtml();
    if (!doc) {
      toast({ title: 'Nothing to print', variant: 'destructive' });
      return;
    }
    printHtmlInHiddenIframe(doc, title);
  }, [resolvePrintDocumentHtml, title]);

  if (!open) return null;

  const useIframe = Boolean(isFullDocument && iframeSrcDoc);
  const useClone = hasDomSource;
  const useFragment = Boolean(fragmentHtml) && !useIframe && !useClone;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/60 backdrop-blur-md p-0 sm:p-4 sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="flex h-full w-full flex-col bg-background shadow-2xl sm:h-[min(92vh,900px)] sm:max-w-5xl sm:rounded-2xl sm:border sm:border-border overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <h2 className="text-base font-semibold text-foreground truncate">{title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="gap-1.5 touch-manipulation"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-10 w-10 rounded-full touch-manipulation"
              onClick={() => onOpenChange(false)}
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto overscroll-contain p-2 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          {useIframe ? (
            <iframe
              ref={iframeRef}
              key={iframeSrcDoc.length}
              title={title}
              srcDoc={iframeSrcDoc}
              className="block w-full max-w-full border-0 bg-white rounded-lg shadow-sm"
              style={{ height: iframeHeight, minHeight: 400 }}
              onLoad={resizeIframe}
            />
          ) : useClone ? (
            <div
              ref={cloneContainerRef}
              className="print-preview-clone mx-auto w-full min-w-0 overflow-x-auto bg-white text-slate-900 p-2 sm:p-4 rounded-lg shadow-sm [&_table]:w-max [&_table]:min-w-full [&_img]:max-w-none"
            />
          ) : useFragment ? (
            <div
              className="print-preview-html mx-auto w-full min-w-0 overflow-x-auto bg-white text-slate-900 p-2 sm:p-4 rounded-lg shadow-sm [&_table]:w-max [&_table]:min-w-full"
              dangerouslySetInnerHTML={{ __html: fragmentHtml }}
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Nothing to preview.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrintPreviewModal;
