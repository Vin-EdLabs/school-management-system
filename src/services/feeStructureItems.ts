import { apiService } from './api';

export type FeeStructureItem = {
  id?: number;
  item_name: string;
  amount: number | null;
  is_active: boolean;
  sort_order: number;
  is_required?: boolean;
};

export type FeeStructureItemsSummary = {
  total: number;
  items: Array<{ item_name: string; amount: number }>;
  label: string;
};

export const DEFAULT_FEE_STRUCTURE_ITEMS: FeeStructureItem[] = [
  { item_name: 'Tuition', amount: null, is_active: true, sort_order: 1, is_required: true },
  { item_name: 'PTA', amount: null, is_active: false, sort_order: 2, is_required: false },
  { item_name: 'ICT', amount: null, is_active: false, sort_order: 3, is_required: false },
  { item_name: 'Library', amount: null, is_active: false, sort_order: 4, is_required: false },
  { item_name: 'Exam Fees', amount: null, is_active: false, sort_order: 5, is_required: false },
];

export type FeeStructureRef = {
  id: string;
  classId?: number;
  class_id?: number;
  className?: string;
  term?: string;
};

export function resolveFeeStructureId(
  feeStructures: FeeStructureRef[],
  classAssigned: string,
  classId?: number | string | null,
  currentTerm?: string | null
): string | null {
  const normalizedTerm = (currentTerm || '').trim();
  const normalizeClassName = (name: string) =>
    String(name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  const studentClass = normalizeClassName(classAssigned);

  const match = feeStructures.find(f => {
    const feeClassId = f.classId ?? f.class_id;
    const feeClassName = normalizeClassName(f.className ?? '');
    const classMatch =
      (classId != null && feeClassId != null && String(feeClassId) === String(classId)) ||
      (feeClassName !== '' && feeClassName === studentClass);
    if (!classMatch) return false;
    if (!normalizedTerm || normalizedTerm === 'Not Set') return true;
    const feeTerm = (f.term || '').trim();
    return !feeTerm || feeTerm === normalizedTerm || feeTerm.includes(normalizedTerm) || normalizedTerm.includes(feeTerm);
  });
  return match?.id ?? null;
}

export async function fetchFeeStructureItems(feeStructureId: string | number): Promise<FeeStructureItem[]> {
  return apiService.get<FeeStructureItem[]>(`/fees/${feeStructureId}/items`);
}

export async function saveFeeStructureItems(
  feeStructureId: string | number,
  items: FeeStructureItem[]
): Promise<{ items: FeeStructureItem[]; total: number }> {
  return apiService.post(`/fees/${feeStructureId}/items`, {
    items: items.map(({ item_name, amount, is_active, sort_order }) => ({
      item_name,
      amount,
      is_active,
      sort_order,
    })),
  });
}

const summaryCache = new Map<string, Promise<FeeStructureItemsSummary>>();

/** Warm the cache without awaiting (e.g. on hover or page load). */
export function prefetchFeeStructureItemsSummary(feeStructureId: string | number): void {
  const key = String(feeStructureId);
  if (!key || summaryCache.has(key)) return;
  summaryCache.set(
    key,
    apiService
      .get<FeeStructureItemsSummary>(`/fees/${feeStructureId}/items/summary`)
      .catch((err) => {
        summaryCache.delete(key);
        throw err;
      })
  );
}

export async function fetchFeeStructureItemsSummary(
  feeStructureId: string | number
): Promise<FeeStructureItemsSummary> {
  const key = String(feeStructureId);
  const cached = summaryCache.get(key);
  if (cached) return cached;
  const request = apiService.get<FeeStructureItemsSummary>(`/fees/${feeStructureId}/items/summary`);
  summaryCache.set(key, request);
  try {
    return await request;
  } catch (err) {
    summaryCache.delete(key);
    throw err;
  }
}

export function formatFeeItemLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (/fee$/i.test(trimmed)) return trimmed;
  return `${trimmed} Fee`;
}

export function computeItemsTotal(items: FeeStructureItem[]): number {
  return items
    .filter(i => i.is_active)
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

export function buildActiveItemsLabel(items: FeeStructureItem[]): string {
  return items
    .filter(i => i.is_active && Number(i.amount) > 0)
    .map(i => i.item_name.trim())
    .join(' + ');
}

export type FeeStructureArchiveItem = {
  item_name: string;
  amount: number;
  is_active: boolean;
  sort_order: number;
};

export type FeeStructureArchiveClass = {
  class_id: number;
  class_name: string;
  level: string | null;
  total: number;
  items: FeeStructureArchiveItem[];
};

export type FeeStructureArchive = {
  id: number;
  tenant_id?: number;
  ledger_term_id?: number;
  term_label: string;
  academic_year?: string | null;
  structure_count: number;
  term_snapshot_id?: number | null;
  created_at?: string;
  structures?: FeeStructureArchiveClass[];
};

export async function fetchFeeStructureArchives(): Promise<FeeStructureArchive[]> {
  return apiService.get<FeeStructureArchive[]>('/fees/archives');
}

export async function fetchFeeStructureArchive(archiveId: number): Promise<FeeStructureArchive> {
  return apiService.get<FeeStructureArchive>(`/fees/archives/${archiveId}`);
}

export async function fetchLatestFeeStructureArchive(): Promise<FeeStructureArchive | null> {
  return apiService.get<FeeStructureArchive | null>('/fees/archives/latest');
}

export type ReuseFeeStructureArchiveResult = {
  message: string;
  structuresCopied: number;
  itemsCopied: number;
  skippedExisting: number;
  billingInserted: number;
  targetTermLabel: string | null;
  sourceTermLabel: string;
};

export async function reuseArchivedFeeStructure(
  archiveId: number,
  options?: { termId?: number; billStudents?: boolean }
): Promise<ReuseFeeStructureArchiveResult> {
  return apiService.post<ReuseFeeStructureArchiveResult>(`/fees/archives/${archiveId}/reuse`, {
    ...(options?.termId != null ? { term_id: options.termId } : {}),
    ...(options?.billStudents ? { bill_students: true } : {}),
  });
}

export type FeeStructureCopySource = {
  sourceType: 'term' | 'archive';
  id: number;
  ledgerTermId: number;
  termLabel: string;
  academicYear: string | null;
  structureCount: number;
  startDate: string | null;
  status: string | null;
};

export type FeeStructureCopySourceDetail = FeeStructureCopySource & {
  structures: FeeStructureArchiveClass[];
};

export async function fetchFeeStructureCopySources(): Promise<FeeStructureCopySource[]> {
  return apiService.get<FeeStructureCopySource[]>('/fees/copy-sources');
}

export async function fetchFeeStructureCopySourceDetail(
  sourceType: 'term' | 'archive',
  sourceId: number
): Promise<FeeStructureCopySourceDetail> {
  return apiService.get<FeeStructureCopySourceDetail>(`/fees/copy-sources/${sourceType}/${sourceId}`);
}

export async function copyFeeStructuresFromTerm(
  sourceTermId: number,
  options?: { termId?: number; billStudents?: boolean }
): Promise<ReuseFeeStructureArchiveResult> {
  return apiService.post<ReuseFeeStructureArchiveResult>(`/fees/copy-from-term/${sourceTermId}`, {
    ...(options?.termId != null ? { term_id: options.termId } : {}),
    ...(options?.billStudents ? { bill_students: true } : {}),
  });
}
