import { query } from '../db/connection.js';

export type SetupProgressRow = {
  has_subjects: boolean;
  has_classes: boolean;
  has_terms: boolean;
  completed_at: string | null;
};

export type SetupProgressResponse = {
  has_subjects: boolean;
  has_classes: boolean;
  has_terms: boolean;
  is_complete: boolean;
};

/** In-memory cache for completed schools — GET returns instantly after setup is done. */
const completeCache = new Set<number>();

export function invalidateSetupProgressCache(schoolId: number): void {
  completeCache.delete(schoolId);
}

export async function ensureSetupProgressRow(schoolId: number): Promise<void> {
  await query(
    `INSERT INTO school_setup_progress (school_id)
     VALUES ($1)
     ON CONFLICT (school_id) DO NOTHING`,
    [schoolId]
  );
}

/** Recalculate flags from subjects / classes / terms tables. */
export async function refreshSetupProgress(schoolId: number): Promise<SetupProgressResponse> {
  try {
    await query('SELECT refresh_school_setup_progress($1)', [schoolId]);
  } catch {
    // Function may not exist before migration — fall through to direct read
  }
  completeCache.delete(schoolId);
  return getSetupProgress(schoolId);
}

export async function getSetupProgress(schoolId: number): Promise<SetupProgressResponse> {
  if (completeCache.has(schoolId)) {
    return {
      has_subjects: true,
      has_classes: true,
      has_terms: true,
      is_complete: true,
    };
  }

  await ensureSetupProgressRow(schoolId);

  const result = await query(
    `SELECT has_subjects, has_classes, has_terms, completed_at
     FROM school_setup_progress
     WHERE school_id = $1`,
    [schoolId]
  );

  const row = result.rows[0] as SetupProgressRow | undefined;
  if (!row) {
    return {
      has_subjects: false,
      has_classes: false,
      has_terms: false,
      is_complete: false,
    };
  }

  const allDone = !!(row.has_subjects && row.has_classes && row.has_terms);
  const isComplete = allDone;

  if (isComplete) {
    completeCache.add(schoolId);
  }

  return {
    has_subjects: !!row.has_subjects,
    has_classes: !!row.has_classes,
    has_terms: !!row.has_terms,
    is_complete: isComplete,
  };
}

/** Fire-and-forget hook after creating setup entities. */
export function notifySetupProgressChanged(schoolId: number): void {
  void refreshSetupProgress(schoolId).catch((err) => {
    console.warn('setup progress refresh failed', schoolId, err?.message || err);
  });
}
