import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Save, Upload, PenLine, X } from 'lucide-react';
import SignaturePad from '@/components/common/SignaturePad';

type HeadmasterSignatureSettingsProps = {
  teacherId: number | string;
};

const HeadmasterSignatureSettings: React.FC<HeadmasterSignatureSettingsProps> = ({ teacherId }) => {
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sigPadOpen, setSigPadOpen] = useState(false);
  const sigInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadSignature();
  }, [teacherId]);

  const loadSignature = async () => {
    setLoading(true);
    try {
      const data = await apiService.get<{ signature?: string | null }>(`/teachers/${teacherId}/signature`);
      setSignatureImage(data?.signature || null);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSignatureImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiService.put(`/teachers/${teacherId}/signature`, { signature: signatureImage });
      toast({
        title: 'Signature saved',
        description: 'Your signature will appear automatically on report cards.',
      });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading signature…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Upload or draw your signature once. It will auto-fill on report cards when you open them.
      </p>

      <div className="space-y-2 border rounded-lg p-3">
        <Label className="font-semibold flex items-center gap-1.5">
          <PenLine className="w-3.5 h-3.5" />
          Headmaster Signature
        </Label>
        {signatureImage ? (
          <div className="relative inline-block">
            <img src={signatureImage} alt="Headmaster signature" className="h-16 object-contain border rounded p-1" />
            <button
              type="button"
              onClick={() => setSignatureImage(null)}
              className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 hover:bg-red-200"
              aria-label="Remove signature"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="h-16 border-2 border-dashed border-slate-300 rounded flex items-center justify-center text-xs text-slate-400">
            No signature set
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <Button type="button" variant="outline" size="sm" onClick={() => setSigPadOpen(true)}>
            <PenLine className="w-3 h-3 mr-1" /> Draw
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => sigInputRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" /> Upload
          </Button>
          <input
            ref={sigInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving} size="sm">
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {saving ? 'Saving…' : 'Save Signature'}
        </Button>
      </div>

      <SignaturePad
        open={sigPadOpen}
        onOpenChange={setSigPadOpen}
        onSave={(dataUrl) => setSignatureImage(dataUrl)}
        title="Draw Headmaster Signature"
      />
    </div>
  );
};

export default HeadmasterSignatureSettings;
