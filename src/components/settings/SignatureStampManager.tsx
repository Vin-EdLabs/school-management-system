import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Save, Upload, PenLine, X, Stamp } from 'lucide-react';
import SignaturePad from '@/components/common/SignaturePad';

const SignatureStampManager: React.FC = () => {
  const [stampImage, setStampImage] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sigPadOpen, setSigPadOpen] = useState(false);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await apiService.get<{ stampImage?: string | null; signatureImage?: string | null }>('/settings/appointment-letter');
      setStampImage(data?.stampImage || null);
      setSignatureImage(data?.signatureImage || null);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (file: File | undefined, setter: (val: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiService.put('/settings/appointment-letter', {
        stampImage,
        signatureImage,
      });
      toast({ title: 'Saved', description: 'Signatures and stamp updated.' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* School Stamp */}
        <div className="space-y-2 border rounded-lg p-3">
          <Label className="font-semibold flex items-center gap-1.5">
            <Stamp className="w-3.5 h-3.5" />
            School Stamp / Seal
          </Label>
          {stampImage ? (
            <div className="relative inline-block">
              <img src={stampImage} alt="School Stamp" className="h-24 object-contain border rounded p-1" />
              <button
                type="button"
                onClick={() => setStampImage(null)}
                className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 hover:bg-red-200"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="h-24 border-2 border-dashed border-slate-300 rounded flex items-center justify-center text-xs text-slate-400">
              No stamp uploaded
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => stampInputRef.current?.click()}>
              <Upload className="w-3 h-3 mr-1" /> Upload
            </Button>
            <input
              ref={stampInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0], setStampImage)}
            />
          </div>
        </div>

        {/* Headmaster Signature */}
        <div className="space-y-2 border rounded-lg p-3">
          <Label className="font-semibold flex items-center gap-1.5">
            <PenLine className="w-3.5 h-3.5" />
            Headmaster / Admin Signature
          </Label>
          {signatureImage ? (
            <div className="relative inline-block">
              <img src={signatureImage} alt="Signature" className="h-16 object-contain border rounded p-1" />
              <button
                type="button"
                onClick={() => setSignatureImage(null)}
                className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 hover:bg-red-200"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="h-16 border-2 border-dashed border-slate-300 rounded flex items-center justify-center text-xs text-slate-400">
              No signature set
            </div>
          )}
          <div className="flex gap-2">
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
              onChange={(e) => handleFile(e.target.files?.[0], setSignatureImage)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving} size="sm">
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <SignaturePad
        open={sigPadOpen}
        onOpenChange={setSigPadOpen}
        onSave={(dataUrl) => setSignatureImage(dataUrl)}
        title="Draw Headmaster / Admin Signature"
      />
    </div>
  );
};

export default SignatureStampManager;
