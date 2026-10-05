import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  ShieldCheck,
  Calendar,
  Hash,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  Car,
  Pencil,
  Plus,
  Files,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import type { StaffLegalDocument } from './otherStaffTypes';

interface StaffLegalDocumentsSectionProps {
  documents: StaffLegalDocument[];
  onChange: (docs: StaffLegalDocument[]) => void;
  isDriver: boolean;
  disabled?: boolean;
}

const COMMON_DOC_CATEGORIES = [
  "Driver's License (Front)",
  "Driver's License (Back)",
  "Driver's License (Full Copy)",
  "Commercial Driving Permit",
  "Road Worthiness / Vehicle Inspection",
  "Vehicle Insurance / Permit",
  "Police Clearance / Background Check",
  "National ID / Ghana Card",
  "Medical Fitness / Vision Certificate",
  "Employment Contract / Agreement",
  "Other Legal Document",
] as const;

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExpiryStatus(expiryDate?: string): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
} | null {
  if (!expiryDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime())) return null;

  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `Expired (${expiryDate})`,
      variant: 'destructive',
      className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300',
    };
  }
  if (diffDays <= 30) {
    return {
      label: `Expiring soon (${expiryDate})`,
      variant: 'outline',
      className: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300',
    };
  }
  return {
    label: `Valid until ${expiryDate}`,
    variant: 'outline',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300',
  };
}

export const StaffLegalDocumentsSection: React.FC<StaffLegalDocumentsSectionProps> = ({
  documents,
  onChange,
  isDriver,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(isDriver || documents.length > 0);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    isDriver ? "Driver's License (Full Copy)" : "National ID / Ghana Card"
  );
  const [customTitle, setCustomTitle] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<StaffLegalDocument | null>(null);

  // Editing existing doc metadata
  const [editingDoc, setEditingDoc] = useState<StaffLegalDocument | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editExpiry, setEditExpiry] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // If role is detected as a driver and section was collapsed, auto-open it
  React.useEffect(() => {
    if (isDriver) {
      setIsOpen(true);
      if (selectedCategory === "National ID / Ghana Card") {
        setSelectedCategory("Driver's License (Full Copy)");
      }
    }
  }, [isDriver, selectedCategory]);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const validFiles: File[] = [];

    for (const file of fileArray) {
      const isAllowed = allowed.includes(file.type) || /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
      if (!isAllowed) {
        toast({
          title: 'Unsupported file format',
          description: `Skipped "${file.name}". Please upload PDF, JPG, PNG, or WebP.`,
          variant: 'destructive',
        });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: `"${file.name}" exceeds 10MB limit.`,
          variant: 'destructive',
        });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    const newDocs: StaffLegalDocument[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setUploadProgressText(`Uploading ${i + 1} of ${validFiles.length}: ${file.name}...`);

      try {
        let docUrl = '';
        try {
          const res = await apiService.uploadOtherStaffDocument(file);
          docUrl = res.url;
        } catch {
          docUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        let effectiveTitle =
          selectedCategory === 'Other Legal Document'
            ? customTitle.trim() || file.name.replace(/\.[^/.]+$/, '')
            : selectedCategory;

        if (validFiles.length > 1) {
          // If multiple files uploaded together, label smartly
          const lowerName = file.name.toLowerCase();
          if (lowerName.includes('front')) {
            effectiveTitle = "Driver's License (Front)";
          } else if (lowerName.includes('back')) {
            effectiveTitle = "Driver's License (Back)";
          } else if (lowerName.includes('permit')) {
            effectiveTitle = "Commercial Driving Permit";
          } else if (lowerName.includes('road') || lowerName.includes('worth')) {
            effectiveTitle = "Road Worthiness / Permit";
          } else if (lowerName.includes('police')) {
            effectiveTitle = "Police Clearance / Background Check";
          } else {
            effectiveTitle = `${effectiveTitle} (${i + 1})`;
          }
        }

        newDocs.push({
          id: `doc_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          title: effectiveTitle,
          type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          url: docUrl,
          document_number: documentNumber.trim() || undefined,
          expiry_date: expiryDate ? expiryDate : undefined,
          uploaded_at: new Date().toISOString(),
          file_size: file.size,
        });
      } catch (err: unknown) {
        toast({
          title: 'Upload failed',
          description: `Could not attach "${file.name}"`,
          variant: 'destructive',
        });
      }
    }

    if (newDocs.length > 0) {
      onChange([...documents, ...newDocs]);
      setDocumentNumber('');
      setExpiryDate('');
      setCustomTitle('');
      toast({
        title: `${newDocs.length} Document${newDocs.length > 1 ? 's' : ''} Attached`,
        description: `Successfully attached ${newDocs.length} document${newDocs.length > 1 ? 's' : ''}. You can attach more documents if needed.`,
      });
    }

    setUploading(false);
    setUploadProgressText('');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      void handleFiles(files);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || uploading) return;
    if (e.dataTransfer.files) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (id: string) => {
    onChange(documents.filter((d) => d.id !== id));
  };

  const handleStartEdit = (doc: StaffLegalDocument) => {
    setEditingDoc(doc);
    setEditTitle(doc.title);
    setEditNumber(doc.document_number || '');
    setEditExpiry(doc.expiry_date || '');
  };

  const handleSaveEdit = () => {
    if (!editingDoc) return;
    onChange(
      documents.map((d) =>
        d.id === editingDoc.id
          ? {
              ...d,
              title: editTitle.trim() || d.title,
              document_number: editNumber.trim() || undefined,
              expiry_date: editExpiry ? editExpiry : undefined,
            }
          : d
      )
    );
    setEditingDoc(null);
    toast({ title: 'Document details updated' });
  };

  const isPdf = (doc: StaffLegalDocument) =>
    doc.type?.toLowerCase().includes('pdf') ||
    doc.name?.toLowerCase().endsWith('.pdf') ||
    doc.url?.startsWith('data:application/pdf');

  return (
    <div className="space-y-3 pt-2">
      {/* Header / Toggle button */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-0 h-9 font-medium text-foreground hover:bg-transparent flex items-center gap-2"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="flex items-center gap-2">
            {isDriver ? (
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                <Car className="w-4 h-4" />
                Driver Legal Documents & Licensing
              </span>
            ) : (
              <span>Legal & Official Documents (optional)</span>
            )}
            {documents.length > 0 && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                {documents.length} attached
              </Badge>
            )}
          </span>
        </Button>
      </div>

      {isOpen && (
        <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4 transition-all">
          {/* Driver specific alert / banner */}
          {isDriver && (
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 p-3.5 text-sm text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Driver & Transport Compliance (Multiple Documents Supported)
                  </p>
                  <p className="text-xs leading-relaxed text-emerald-800/90 dark:text-emerald-300/90">
                    Attach copies of the driver's <strong>Driver's License (Front & Back)</strong>, Commercial Driving Permit, Road Worthiness certificate, or Police Clearance. You can upload multiple files at once or add them one by one.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Form to attach documents */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-lg border bg-card p-4 space-y-3.5 shadow-sm transition-all ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/30'
                : 'border-border/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                Add Documents (Select one or multiple files)
              </p>
              {documents.length > 0 && (
                <span className="text-xs text-muted-foreground font-medium">
                  {documents.length} document{documents.length > 1 ? 's' : ''} added
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Document Type</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                  disabled={disabled || uploading}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_DOC_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-xs">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCategory === 'Other Legal Document' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Document Title *</Label>
                  <Input
                    className="h-9 text-xs"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. Fire Safety Certificate"
                    disabled={disabled || uploading}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">License / Document # (optional)</Label>
                  <Input
                    className="h-9 text-xs font-mono"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="e.g. DL-981240-B"
                    disabled={disabled || uploading}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Expiration Date (optional)</Label>
                <Input
                  type="date"
                  className="h-9 text-xs"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  disabled={disabled || uploading}
                />
              </div>
            </div>

            {selectedCategory === 'Other Legal Document' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">Document # (optional)</Label>
                  <Input
                    className="h-9 text-xs font-mono"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="e.g. CERT-2024-001"
                    disabled={disabled || uploading}
                  />
                </div>
              </div>
            )}

            {/* Drag & drop helper / file input bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
              <span className="text-[11px] text-muted-foreground">
                Drag & drop files here or click button. Supports multiple PDF, PNG, JPG, WebP files (up to 10MB each).
              </span>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileInputChange}
                disabled={disabled || uploading}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-2 text-xs font-medium border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {uploadProgressText || 'Uploading documents...'}
                  </>
                ) : (
                  <>
                    <Files className="w-3.5 h-3.5" />
                    Select Document(s) to Upload
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* List of currently attached documents */}
          {documents.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Attached Documents ({documents.length})
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 gap-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || uploading}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add More Documents
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {documents.map((doc, idx) => {
                  const expiryStatus = getExpiryStatus(doc.expiry_date);
                  const pdf = isPdf(doc);

                  return (
                    <div
                      key={doc.id || idx}
                      className="group flex flex-col justify-between rounded-lg border border-border bg-card p-3 shadow-xs hover:border-emerald-500/40 transition"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/60 overflow-hidden">
                          {pdf ? (
                            <FileText className="h-5 w-5 text-red-500" />
                          ) : (
                            <img
                              src={doc.url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-xs font-semibold text-foreground truncate" title={doc.title}>
                            {doc.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate" title={doc.name}>
                            {doc.name} {doc.file_size ? `· ${formatFileSize(doc.file_size)}` : ''}
                          </p>

                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {doc.document_number && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                                <Hash className="w-2.5 h-2.5 mr-0.5" />
                                {doc.document_number}
                              </Badge>
                            )}
                            {expiryStatus && (
                              <Badge variant={expiryStatus.variant} className={`text-[10px] px-1.5 py-0 ${expiryStatus.className}`}>
                                <Calendar className="w-2.5 h-2.5 mr-0.5" />
                                {expiryStatus.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-1 border-t border-border/40 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleStartEdit(doc)}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Edit Details
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setPreviewDoc(doc)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Preview
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                          onClick={() => handleRemove(doc.id)}
                          disabled={disabled}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border py-5 px-3 text-center text-xs text-muted-foreground space-y-1">
              <Files className="w-6 h-6 mx-auto text-muted-foreground/60 mb-1" />
              <p className="font-medium text-foreground">No documents attached yet</p>
              <p>
                {isDriver
                  ? 'Attach Driver’s License (front & back), commercial permits, or roadworthiness using the upload area above.'
                  : 'Attach copies of legal documents or identification using the upload area above.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit Document Metadata Dialog */}
      {editingDoc && (
        <Dialog open={!!editingDoc} onOpenChange={(open) => !open && setEditingDoc(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Edit Document Details</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Document Title / Label</Label>
                <Input
                  className="h-9 text-xs"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Driver's License (Front)"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">License / Document Number</Label>
                <Input
                  className="h-9 text-xs font-mono"
                  value={editNumber}
                  onChange={(e) => setEditNumber(e.target.value)}
                  placeholder="e.g. DL-489102-B"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expiration Date</Label>
                <Input
                  type="date"
                  className="h-9 text-xs"
                  value={editExpiry}
                  onChange={(e) => setEditExpiry(e.target.value)}
                />
              </div>
            </DialogBody>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingDoc(null)}>
                Cancel
              </Button>
              <Button type="button" variant="default" size="sm" onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="px-5 py-3 border-b border-border/70 flex flex-row items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-base">{previewDoc.title}</DialogTitle>
                <p className="text-xs text-muted-foreground truncate">{previewDoc.name}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                asChild
              >
                <a href={previewDoc.url} target="_blank" rel="noreferrer" download={previewDoc.name}>
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab
                </a>
              </Button>
            </DialogHeader>
            <DialogBody className="p-4 flex items-center justify-center bg-slate-900/5 min-h-[350px] overflow-auto">
              {isPdf(previewDoc) ? (
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

export default StaffLegalDocumentsSection;
