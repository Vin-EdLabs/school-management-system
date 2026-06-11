import { useSyncExternalStore } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import type { Student } from '@/contexts/DataContext';
import { mapStudent } from '@/utils/studentMappers';

export type StudentsCacheData = { students: Student[] };

export const studentsQueryKeys = {
  list: (tenantId: number | string | null) => ['students', tenantId] as const,
  detail: (tenantId: number | string | null, id: string) => ['students', tenantId, id] as const,
  photo: (tenantId: number | string | null, id: string) => ['students', tenantId, id, 'photo'] as const,
};

export type PhotoUploadStatus = 'idle' | 'uploading' | 'failed';

type PendingPhotoUpload = { file: File; previewUrl?: string };

const photoStatuses = new Map<string, PhotoUploadStatus>();
const pendingPhotoUploads = new Map<string, PendingPhotoUpload>();
const photoListeners = new Set<() => void>();
let studentsStateSync: ((students: Student[]) => void) | null = null;

export function bindStudentsStateSync(sync: ((students: Student[]) => void) | null) {
  studentsStateSync = sync;
}

function notifyPhotoListeners() {
  photoListeners.forEach((listener) => listener());
}

export function setPhotoUploadStatus(studentId: string, status: PhotoUploadStatus) {
  if (status === 'idle') {
    photoStatuses.delete(studentId);
  } else {
    photoStatuses.set(studentId, status);
  }
  notifyPhotoListeners();
}

export function getPhotoUploadStatus(studentId: string): PhotoUploadStatus {
  return photoStatuses.get(studentId) ?? 'idle';
}

export function useStudentPhotoUploadStatus(studentId: string): PhotoUploadStatus {
  return useSyncExternalStore(
    (onStoreChange) => {
      photoListeners.add(onStoreChange);
      return () => photoListeners.delete(onStoreChange);
    },
    () => getPhotoUploadStatus(studentId),
    () => 'idle'
  );
}

export function patchStudentsCache(
  queryClient: QueryClient,
  tenantId: number | string | null,
  updater: (students: Student[]) => Student[]
): Student[] {
  queryClient.setQueryData<StudentsCacheData>(studentsQueryKeys.list(tenantId), (old) => ({
    students: updater(old?.students ?? []),
  }));
  const next =
    queryClient.getQueryData<StudentsCacheData>(studentsQueryKeys.list(tenantId))?.students ?? [];
  studentsStateSync?.(next);
  return next;
}

export function setStudentsCache(
  queryClient: QueryClient,
  tenantId: number | string | null,
  students: Student[]
) {
  queryClient.setQueryData<StudentsCacheData>(studentsQueryKeys.list(tenantId), { students });
}

export function appendStudentToCache(
  queryClient: QueryClient,
  tenantId: number | string | null,
  student: Student
): Student[] {
  return patchStudentsCache(queryClient, tenantId, (list) => [student, ...list]);
}

export function replaceStudentInCache(
  queryClient: QueryClient,
  tenantId: number | string | null,
  matchId: string,
  student: Student
): Student[] {
  return patchStudentsCache(queryClient, tenantId, (list) =>
    list.map((s) => (s.id === matchId ? student : s))
  );
}

export function patchStudentInCache(
  queryClient: QueryClient,
  tenantId: number | string | null,
  studentId: string,
  patch: Partial<Student>
): Student[] {
  return patchStudentsCache(queryClient, tenantId, (list) =>
    list.map((s) => (s.id === studentId ? { ...s, ...patch } : s))
  );
}

export function removeStudentFromCache(
  queryClient: QueryClient,
  tenantId: number | string | null,
  studentId: string
): Student[] {
  return patchStudentsCache(queryClient, tenantId, (list) => list.filter((s) => s.id !== studentId));
}

export async function fetchStudentPhoto(
  queryClient: QueryClient,
  tenantId: number | string | null,
  studentId: string
): Promise<string | undefined> {
  const key = studentsQueryKeys.photo(tenantId, studentId);
  const cached = queryClient.getQueryData<{ passport_photo_url?: string }>(key);
  if (cached?.passport_photo_url) return cached.passport_photo_url;

  const result = await apiService.get<{ passport_photo_url?: string }>(`/students/${studentId}/photo`);
  const url = result?.passport_photo_url || undefined;
  queryClient.setQueryData(key, { passport_photo_url: url });
  if (url) {
    patchStudentInCache(queryClient, tenantId, studentId, {
      passportPhotoUrl: url,
      hasPassportPhoto: true,
    });
  }
  return url;
}

export async function uploadStudentPhotoInBackground(
  queryClient: QueryClient,
  tenantId: number | string | null,
  studentId: string,
  file: File,
  previewUrl?: string
): Promise<void> {
  pendingPhotoUploads.set(studentId, { file, previewUrl });
  setPhotoUploadStatus(studentId, 'uploading');

  if (previewUrl) {
    patchStudentInCache(queryClient, tenantId, studentId, {
      passportPhotoUrl: previewUrl,
      hasPassportPhoto: true,
    });
  }

  try {
    const result = (await apiService.uploadStudentPhoto(studentId, file)) as {
      passport_photo_url?: string;
    };
    const url = result?.passport_photo_url;
    if (url) {
      patchStudentInCache(queryClient, tenantId, studentId, {
        passportPhotoUrl: url,
        hasPassportPhoto: true,
      });
      queryClient.setQueryData(studentsQueryKeys.photo(tenantId, studentId), {
        passport_photo_url: url,
      });
    }
    pendingPhotoUploads.delete(studentId);
    setPhotoUploadStatus(studentId, 'idle');
  } catch {
    setPhotoUploadStatus(studentId, 'failed');
  }
}

export function retryStudentPhotoUpload(
  queryClient: QueryClient,
  tenantId: number | string | null,
  studentId: string
): void {
  const pending = pendingPhotoUploads.get(studentId);
  if (!pending) return;
  void uploadStudentPhotoInBackground(
    queryClient,
    tenantId,
    studentId,
    pending.file,
    pending.previewUrl
  );
}
