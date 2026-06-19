import React from 'react';
import { Loader2, Printer, FileText, Image } from 'lucide-react';
import type { CardExportOptions } from './idCardExport';
import { handleDownloadPDF, handleDownloadPNG, handlePrintCard } from './idCardExport';

type CardExportButtonsProps = {
  options: CardExportOptions;
  exporting: boolean;
  activeAction?: string | null;
};

const btnBase: React.CSSProperties = {
  flex: 1,
  height: 40,
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#374151',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  transition: 'background 150ms ease, border-color 150ms ease',
  minWidth: 0,
};

const buttons = [
  { key: 'print', label: 'Print', Icon: Printer },
  { key: 'pdf', label: 'PDF', Icon: FileText },
  { key: 'front', label: 'Front', Icon: Image },
  { key: 'back', label: 'Back', Icon: Image },
] as const;

export function CardExportButtons({ options, exporting, activeAction }: CardExportButtonsProps) {
  const run = (key: typeof buttons[number]['key']) => {
    if (key === 'print') void handlePrintCard(options, key);
    else if (key === 'pdf') void handleDownloadPDF(options, key);
    else void handleDownloadPNG(key, options, key);
  };

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {buttons.map(({ key, label, Icon }) => {
        const active = exporting && activeAction === key;
        return (
          <button
            key={key}
            type="button"
            disabled={exporting}
            onClick={() => run(key)}
            style={{
              ...btnBase,
              opacity: exporting ? 0.5 : 1,
              cursor: exporting ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!exporting) {
                e.currentTarget.style.background = '#f9fafb';
                e.currentTarget.style.borderColor = '#d1d5db';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            {active ? <Loader2 size={14} className="animate-spin" /> : <Icon size={15} />}
            {active ? 'Generating…' : label}
          </button>
        );
      })}
    </div>
  );
}

export default CardExportButtons;
