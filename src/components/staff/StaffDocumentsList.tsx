import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { Calendar, Download, ExternalLink, Eye, FileText, Hash, ShieldCheck } from 'lucide-react';
import type { StaffLegalDocument } from './otherStaffTypes';

export function isPdfDocument(doc: Pick<StaffLegalDocument, 'type' | 'name' | 'url'>): boolean {
  return (
    !!doc.type?.toLowerCase().includes('pdf') ||
    !!doc.name?.toLowerCase().endsWith('.pdf') ||
    !!doc.url?.startsWith('data:application/pdf')
  );
}

interface StaffDocumentsListProps {
  documents: StaffLegalDocument[];
  title?: string;
}

/** Read-only grid of attached staff documents with preview and download. */
const StaffDocumentsList: React.FC<StaffDocumentsListProps> = ({
  documents,
  title = 'Legal & Official Documents',
}) => {
  const [previewDoc, setPreviewDoc] = useState<StaffLegalDocument | null>(null);

  if (documents.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        </div>
        <Badge variant="secondary" className="text-xs">
          {documents.length} document{documents.length > 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {documents.map((doc) => {
          const pdf = isPdfDocument(doc);
          return (
            <div
              key={doc.id}
              className="flex flex-col justify-between rounded-lg border border-border/80 bg-muted/20 p-3 hover:border-emerald-500/40 transition"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card border border-border/60">
                  {pdf ? (
                    <FileText className="h-5 w-5 text-red-500" />
                  ) : (
                    <img src={doc.url} alt="" className="h-8 w-8 rounded object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs font-semibold text-foreground truncate" title={doc.title}>
                    {doc.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate" title={doc.name}>
                    {doc.name}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {doc.document_number && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                        <Hash className="w-2.5 h-2.5 mr-0.5" />
                        {doc.document_number}
                      </Badge>
                    )}
                    {doc.expiry_date && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        <Calendar className="w-2.5 h-2.5 mr-0.5" />
                        Expires: {doc.expiry_date}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-end gap-1 border-t border-border/40 pt-2">
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPreviewDoc(doc)}>
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  Preview
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                  <a href={doc.url} download={doc.name} target="_blank" rel="noreferrer">
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download
                  </a>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="px-5 py-3 border-b border-border/70 flex flex-row items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-base">{previewDoc.title}</DialogTitle>
                <p className="text-xs text-muted-foreground truncate">{previewDoc.name}</p>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
                <a href={previewDoc.url} target="_blank" rel="noreferrer" download={previewDoc.name}>
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab
                </a>
              </Button>
            </DialogHeader>
            <DialogBody className="p-4 flex items-center justify-center bg-slate-900/5 min-h-[350px] overflow-auto">
              {isPdfDocument(previewDoc) ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.title}
                  className="w-full h-[65vh] rounded-md border border-border bg-white"
                />
              ) : (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.title}
                  className="max-h-[70vh] max-w-full rounded-md object-contain shadow-sm"
                />
              )}
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default StaffDocumentsList;
