import { apiService } from './api';

export type StaffFieldType = 'position' | 'department';

export async function fetchStaffFieldSuggestions(field: StaffFieldType): Promise<string[]> {
  const res = await apiService.get<{ names?: string[] }>(`/staff-field-suggestions?field=${field}`);
  return Array.isArray(res?.names) ? res.names : [];
}

export async function persistStaffFieldSuggestion(field: StaffFieldType, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    await apiService.post('/staff-field-suggestions', { field, name: trimmed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.toLowerCase().includes('already')) throw err;
  }
}

export async function persistStaffProfileFields(
  position?: string | null,
  department?: string | null
): Promise<void> {
  await Promise.all([
    position?.trim() ? persistStaffFieldSuggestion('position', position) : Promise.resolve(),
    department?.trim() ? persistStaffFieldSuggestion('department', department) : Promise.resolve(),
  ]);
}
