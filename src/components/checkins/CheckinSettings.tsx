import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, QrCode, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { checkinService, QrContent } from '@/services/checkinService';
import { toast } from '@/hooks/use-toast';

const PDF_WIDTH = 210; // A4 mm
const PDF_HEIGHT = 297;

const qrMeta: Record<string, { title: string; filename: string; color: string; instructions: string[] }> = {
  check_in: {
    title: 'Morning Drop-off QR Code',
    filename: 'morning-drop-off-qr.pdf',
    color: '#16a34a',
    instructions: [
      '1. Open your Parent Portal app on your phone.',
      '2. Tap the QR Scanner icon.',
      '3. Point your camera at this QR code.',
      '4. Select the child(ren) you are dropping off.',
      '5. Confirm to record the drop-off time.',
    ],
  },
  check_out: {
    title: 'Afternoon Pick-up QR Code',
    filename: 'afternoon-pick-up-qr.pdf',
    color: '#2563eb',
    instructions: [
      '1. Open your Parent Portal app on your phone.',
      '2. Tap the QR Scanner icon.',
      '3. Point your camera at this QR code.',
      '4. Select the child(ren) you are picking up.',
      '5. Confirm to record the pick-up time.',
    ],
  },
};

const CheckinSettings: React.FC = () => {
  const [qrContent, setQrContent] = useState<QrContent | null>(null);
  const [loading, setLoading] = useState(true);
  const canvRef = useRef<Record<string, HTMLCanvasElement | null>>({});

  const fetchQrContent = useCallback(async () => {
    setLoading(true);
    try {
      const data = await checkinService.getQrContent();
      setQrContent(data);
    } catch {
      setQrContent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQrContent();
  }, [fetchQrContent]);

  const downloadPdf = (action: 'check_in' | 'check_out') => {
    const qrEl = document.getElementById(`qr-${action}`) as HTMLCanvasElement;
    if (!qrEl) return;

    const meta = qrMeta[action];
    const qrDataUrl = qrEl.toDataURL('image/png');

    const doc = new jsPDF('p', 'mm', 'a4');
    const cx = PDF_WIDTH / 2;

    // Accent bar at top
    doc.setFillColor(meta.color);
    doc.rect(0, 0, PDF_WIDTH, 40, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('SCHOOL CHECK-IN SYSTEM', cx, 18, { align: 'center' });
    doc.setFontSize(14);
    doc.text(meta.title, cx, 30, { align: 'center' });

    // QR code
    const qrSize = 100;
    doc.addImage(qrDataUrl, 'PNG', cx - qrSize / 2, 60, qrSize, qrSize);

    // Instructions
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text('How to use:', cx, 180, { align: 'center' });
    doc.setFontSize(10);
    let y = 192;
    for (const line of meta.instructions) {
      doc.text(line, cx, y, { align: 'center' });
      y += 7;
    }

    // Footer
    const now = new Date();
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`, cx, 280, { align: 'center' });

    doc.save(meta.filename);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-emerald-600" /> Check-in QR Codes
        </h2>
        <button
          type="button"
          onClick={fetchQrContent}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold">Instructions:</p>
        <ol className="mt-2 list-decimal list-inside space-y-1 text-amber-700">
          <li>Download the <strong>Drop-off QR</strong> and <strong>Pick-up QR</strong> codes below</li>
          <li>Print and laminate them (A5 or larger)</li>
          <li>Post them at the school entrance gate</li>
          <li>Parents scan the appropriate QR code from the Parent Portal app</li>
        </ol>
      </div>

      {!qrContent ? (
        <div className="text-center py-8 text-slate-500">
          <p>Could not load QR code information. Check your tenant configuration.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Drop-off QR */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-center space-y-3">
            <h3 className="text-sm font-bold text-green-700">Drop-off QR Code</h3>
            <p className="text-xs text-slate-500">For parents dropping off children</p>
            <div className="flex justify-center">
              <QRCodeCanvas
                id="qr-check_in"
                value={qrContent.checkInUrl}
                size={200}
                level="M"
                className="border-2 border-green-100 rounded-lg"
              />
            </div>
            <p className="text-[10px] text-slate-400 break-all">{qrContent.checkInUrl}</p>
            <button
              type="button"
              onClick={() => downloadPdf('check_in')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>

          {/* Pick-up QR */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-center space-y-3">
            <h3 className="text-sm font-bold text-blue-700">Pick-up QR Code</h3>
            <p className="text-xs text-slate-500">For parents picking up children</p>
            <div className="flex justify-center">
              <QRCodeCanvas
                id="qr-check_out"
                value={qrContent.checkOutUrl}
                size={200}
                level="M"
                className="border-2 border-blue-100 rounded-lg"
              />
            </div>
            <p className="text-[10px] text-slate-400 break-all">{qrContent.checkOutUrl}</p>
            <button
              type="button"
              onClick={() => downloadPdf('check_out')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default CheckinSettings;
