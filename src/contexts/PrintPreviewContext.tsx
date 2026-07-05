import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import PrintPreviewModal from '../components/common/PrintPreviewModal';
import { printHtmlInHiddenIframe } from '../utils/printHtml';

export type PrintPreviewOptions = {
  title?: string;
  html?: string;
  printDocumentHtml?: string;
  contentRef?: React.RefObject<HTMLElement | null>;
  contentElement?: HTMLElement | null;
  printStyles?: string;
  isFullDocument?: boolean;
};

export function openPrintDocument(html: string, title = 'Preview') {
  openPrintPreview({ title, html, printDocumentHtml: html, isFullDocument: true });
}

type PrintPreviewContextValue = {
  openPrintPreview: (options: PrintPreviewOptions) => void;
  openPreview: (options: PrintPreviewOptions) => void;
  closePrintPreview: () => void;
};

const PrintPreviewContext = createContext<PrintPreviewContextValue | null>(null);

let globalOpenPrintPreview: ((options: PrintPreviewOptions) => void) | null = null;

export function openPrintPreview(options: PrintPreviewOptions) {
  if (globalOpenPrintPreview) {
    globalOpenPrintPreview(options);
    return;
  }
  const doc = options.printDocumentHtml || options.html || '';
  if (doc) {
    printHtmlInHiddenIframe(doc, options.title || 'Print');
  }
}

export function PrintPreviewProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PrintPreviewOptions>({});

  const openPrintPreview = useCallback((opts: PrintPreviewOptions) => {
    setOptions(opts);
    setOpen(true);
  }, []);

  const closePrintPreview = useCallback(() => setOpen(false), []);

  const openPreview = openPrintPreview;

  useEffect(() => {
    globalOpenPrintPreview = openPrintPreview;
    return () => {
      globalOpenPrintPreview = null;
    };
  }, [openPrintPreview]);

  return (
    <PrintPreviewContext.Provider value={{ openPrintPreview, openPreview, closePrintPreview }}>
      {children}
      <PrintPreviewModal
        open={open}
        onOpenChange={setOpen}
        title={options.title || 'Preview'}
        html={options.html}
        printDocumentHtml={options.printDocumentHtml}
        contentRef={options.contentRef}
        contentElement={options.contentElement}
        printStyles={options.printStyles}
        isFullDocument={options.isFullDocument}
      />
    </PrintPreviewContext.Provider>
  );
}

export function usePrintPreview() {
  const ctx = useContext(PrintPreviewContext);
  if (!ctx) {
    return {
      openPrintPreview,
      openPreview: openPrintPreview,
      closePrintPreview: () => undefined,
    };
  }
  return ctx;
}
