import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogDescription,
  detailDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { PenLine } from 'lucide-react';

type SignaturePadProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dataUrl: string) => void;
  title?: string;
};

const SignaturePad: React.FC<SignaturePadProps> = ({
  open,
  onOpenChange,
  onSave,
  title = 'Draw Digital Signature',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [, setForceUpdate] = useState(0);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setForceUpdate((n) => n + 1);
  }, []);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => clearCanvas(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [open, clearCanvas]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasInk = pixels.some((_, i) => i % 4 === 3 && pixels[i] > 0);
    if (!hasInk) {
      toast({ title: 'Please draw your signature first', variant: 'destructive' });
      return;
    }
    onSave(canvas.toDataURL());
    onOpenChange(false);
    toast({ title: 'Signature saved' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${detailDialogContentClass} sm:max-w-md`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800">
              <PenLine className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-1">
                Draw your signature using your mouse or touch screen.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
          <div className="rounded-xl border-2 border-emerald-200 bg-slate-50 overflow-hidden shadow-inner dark:border-emerald-800/60 dark:bg-slate-900/50">
            <canvas
              ref={canvasRef}
              width={480}
              height={200}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="block w-full h-[200px] cursor-crosshair touch-none bg-white dark:bg-slate-950"
            />
          </div>
        </DialogBody>

        <DialogFooter className={`${detailDialogFooterClass} flex-wrap sm:justify-between`}>
          <Button type="button" variant="outline" onClick={clearCanvas}>
            Clear
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primaryAction" onClick={handleSave}>
              Save signature
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SignaturePad;
