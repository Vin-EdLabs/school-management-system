import { apiService } from './api';

export type FeeStructureItem = {
  id?: number;
  item_name: string;
  amount: number;
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
  { item_name: 'Tuition', amount: 0, is_active: true, sort_order: 1, is_required: true },
  { item_name: 'PTA', amount: 0, is_active: false, sort_order: 2, is_required: false },
  { item_name: 'ICT', amount: 0, is_active: false, sort_order: 3, is_required: false },
  { item_name: 'Library', amount: 0, is_active: false, sort_order: 4, is_required: false },
  { item_name: 'Exam Fees', amount: 0, is_active: false, sort_order: 5, is_required: false },
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
  const match = feeStructures.find(f => {
    const feeClassId = f.classId ?? f.class_id;
    const classMatch =
      (classId != null && feeClassId != null && String(feeClassId) === String(classId)) ||
      (f.className && f.className.trim() === classAssigned.trim());
    if (!classMatch) return false;
    if (!normalizedTerm || normalizedTerm === 'Not Set') return true;
    const feeTerm = (f.term || '').trim();
    return !feeTerm || feeTerm === normalizedTerm || feeTerm.includes(normalizedTerm);
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

export async function fetchFeeStructureItemsSummary(
  feeStructureId: string | number
): Promise<FeeStructureItemsSummary> {
  return apiService.get<FeeStructureItemsSummary>(`/fees/${feeStructureId}/items/summary`);
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
