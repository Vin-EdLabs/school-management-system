import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CardEntityType } from '@/types/idCard';
import { CARD_HEIGHT_PX, CARD_WIDTH_PX } from '@/types/idCard';
import { fetchCardExportPayload } from './idCardExport';
import StudentCardFront, { StudentCardBack } from './StudentCardFront';
import StaffCardFront, { StaffCardBack } from './StaffCardFront';
import { ScaledCardPreview } from './ScaledCardPreview';
import { resolveLogoUrl } from '@/services/tenantService';

const PREVIEW_SCALE = 0.17;

type BulkCardPreviewTileProps = {
  entityType: CardEntityType;
  entityId: number;
  staffType?: string;
  fullName: string;
  subtitle?: string;
  photoUrl?: string | null;
  idNumber?: string;
  selected?: boolean;
  onToggle?: () => void;
  showCheckbox?: boolean;
};

const BulkCardPreviewTile: React.FC<BulkCardPreviewTileProps> = ({
  entityType,
  entityId,
  staffType,
  fullName,
  subtitle,
  photoUrl,
  idNumber,
  selected,
  onToggle,
  showCheckbox,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof fetchCardExportPayload>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void fetchCardExportPayload(entityType, entityId, staffType)
      .then((res) => {
        if (!cancelled) setPayload(res);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, staffType]);

  const Front = entityType === 'STUDENT' ? StudentCardFront : StaffCardFront;
  const Back = entityType === 'STUDENT' ? StudentCardBack : StaffCardBack;
  const photo = resolveLogoUrl(photoUrl || payload?.data.photoUrl);
  const cardW = CARD_WIDTH_PX * PREVIEW_SCALE;
  const cardH = CARD_HEIGHT_PX * PREVIEW_SCALE;

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all dark:bg-slate-900 ${
        selected
          ? 'border-indigo-300 ring-2 ring-indigo-200 dark:border-indigo-700 dark:ring-indigo-900/50'
          : 'border-slate-200 dark:border-slate-700'
      } ${onToggle ? 'cursor-pointer hover:shadow-md' : ''}`}
      onClick={onToggle}
      role={onToggle ? 'button' : undefined}
    >
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
        )}
        <div className="relative shrink-0">
          {photo ? (
            <img
              src={photo}
              alt=""
              className="h-11 w-11 rounded-full object-cover ring-2 ring-white shadow-sm dark:ring-slate-700"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {fullName.slice(0, 1)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{fullName}</p>
          <p className="truncate text-xs text-slate-500">
            {[idNumber, subtitle].filter(Boolean).join(' · ') || entityType}
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-b from-slate-50 to-white p-4 dark:from-slate-900 dark:to-slate-950">
        {loading ? (
          <div className="flex h-28 items-center justify-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error || !payload ? (
          <p className="py-8 text-center text-xs text-slate-400">Could not load card preview</p>
        ) : (
          <div className="flex flex-wrap items-start justify-center gap-4">
            <div className="text-center">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Front</p>
              <div style={{ width: cardW, height: cardH }}>
                <ScaledCardPreview scale={PREVIEW_SCALE} shadow>
                  <Front data={payload.data} colors={payload.colors} printMode />
                </ScaledCardPreview>
              </div>
            </div>
            <div className="text-center">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Back</p>
              <div style={{ width: cardW, height: cardH }}>
                <ScaledCardPreview scale={PREVIEW_SCALE} shadow>
                  <Back data={payload.data} colors={payload.colors} printMode />
                </ScaledCardPreview>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkCardPreviewTile;
