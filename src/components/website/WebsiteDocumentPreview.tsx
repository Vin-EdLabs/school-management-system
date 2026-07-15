import React, { useState } from 'react';
import { Download, ExternalLink, FileText, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveWebsiteImageUrl } from '@/services/schoolWebsiteService';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type WebsiteDocument = {
  name?: string;
  url?: string;
  label?: string;
  type?: string;
};

function isPdfDoc(doc: WebsiteDocument, url: string | null): boolean {
  const type = String(doc.type || '').toLowerCase();
  const name = String(doc.name || doc.label || '').toLowerCase();
  return type.includes('pdf') || name.endsWith('.pdf') || Boolean(url?.startsWith('data:application/pdf'));
}

function isImageDoc(doc: WebsiteDocument, url: string | null): boolean {
  const type = String(doc.type || '').toLowerCase();
  const name = String(doc.name || doc.label || '').toLowerCase();
  return (
    type.startsWith('image/') ||
    /\.(jpe?g|png|webp|gif)$/i.test(name) ||
    Boolean(url?.startsWith('data:image/'))
  );
}

export function WebsiteDocumentPreview({
  doc,
  label,
  className,
  compact = false,
}: {
  doc: WebsiteDocument;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const [lightbox, setLightbox] = useState(false);
  const url = doc.url ? resolveWebsiteImageUrl(String(doc.url)) : null;
  const title = label || doc.label || doc.name || 'Document';
  const pdf = isPdfDoc(doc, url);
  const image = isImageDoc(doc, url);

  if (!url) {
    return (
      <div className={cn('rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground', className)}>
        No file attached
      </div>
    );
  }

  if (image) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className={cn(
            'group relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-900/40',
            compact ? 'max-h-56' : 'max-h-[28rem]',
            className
          )}
        >
          <img src={url} alt={title} className="max-h-[28rem] w-full object-contain p-2" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow">
              <ZoomIn className="h-3.5 w-3.5" />
              View full size
            </span>
          </span>
        </button>
        <Dialog open={lightbox} onOpenChange={setLightbox}>
          <DialogContent className="max-w-4xl border-0 bg-black/95 p-2 sm:max-w-5xl">
            <DialogHeader className="sr-only">
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <DialogBody className="flex max-h-[85vh] items-center justify-center p-2">
              <img src={url} alt={title} className="max-h-[82vh] max-w-full object-contain" />
            </DialogBody>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (pdf) {
    return (
      <div className={cn('overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700', className)}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <FileText className="h-4 w-4 text-red-500" />
            {title}
          </span>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" asChild>
              <a href={url} download={doc.name || 'document.pdf'}>
                <Download className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
        <iframe title={title} src={url} className={cn('w-full border-0 bg-white', compact ? 'h-72' : 'h-[32rem]')} />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3', className)}>
      <span className="flex items-center gap-2 text-sm font-medium">
        <FileText className="h-4 w-4 text-muted-foreground" />
        {title}
      </span>
      <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" asChild>
        <a href={url} target="_blank" rel="noreferrer">
          Open file
        </a>
      </Button>
    </div>
  );
}

export function WebsiteDocumentGrid({ documents }: { documents: WebsiteDocument[] }) {
  if (!documents.length) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {documents.map((doc, i) => (
        <WebsiteDocumentPreview key={`${doc.label || doc.name}-${i}`} doc={doc} />
      ))}
    </div>
  );
}
