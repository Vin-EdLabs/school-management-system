import { query } from '../db/connection.js';

export type SetupProgressResponse = {
  has_subjects: boolean;
  has_classes: boolean;
  has_terms: boolean;
  is_complete: boolean;
};

const completeCache = new Set<number>();

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const r = await query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
      [tableName]
    );
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

/** Always derive progress from live rows — never trust stale flags alone. */
async function existsForTenant(tableName: string, schoolId: number): Promise<boolean> {
  if (!(await tableExists(tableName))) return false;
  try {
    const r = await query(`SELECT EXISTS(SELECT 1 FROM ${tableName} WHERE tenant_id = $1) AS ok`, [schoolId]);
    return !!r.rows[0]?.ok;
  } catch {
    return false;
  }
}

export async function computeLiveSetupProgress(schoolId: number): Promise<SetupProgressResponse> {
  const has_subjects = await existsForTenant('subjects', schoolId);
  const has_classes = await existsForTenant('classes', schoolId);

  let hasTerms = await existsForTenant('academic_terms', schoolId);

  if (!hasTerms && (await tableExists('academic_years'))) {
    const yearsRes = await query(
      `SELECT EXISTS(SELECT 1 FROM academic_years WHERE tenant_id = $1) AS ok`,
      [schoolId]
    );
    hasTerms = !!yearsRes.rows[0]?.ok;
  }

  const has_terms = hasTerms;
  const is_complete = has_subjects && has_classes && has_terms;

  if (await tableExists('school_setup_progress')) {
    try {
      await query(
        `INSERT INTO school_setup_progress (school_id, has_subjects, has_classes, has_terms, completed_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (school_id) DO UPDATE SET
           has_subjects = EXCLUDED.has_subjects,
           has_classes = EXCLUDED.has_classes,
           has_terms = EXCLUDED.has_terms,
           completed_at = CASE WHEN EXCLUDED.has_subjects AND EXCLUDED.has_classes AND EXCLUDED.has_terms
             THEN COALESCE(school_setup_progress.completed_at, NOW()) ELSE NULL END,
           updated_at = NOW()`,
        [schoolId, has_subjects, has_classes, has_terms, is_complete ? new Date() : null]
      );
    } catch {
      // non-fatal
    }
  }

  if (is_complete) {
    completeCache.add(schoolId);
  } else {
    completeCache.delete(schoolId);
  }

  return { has_subjects, has_classes, has_terms, is_complete };
}

export async function ensureSetupProgressRow(schoolId: number): Promise<void> {
  if (!(await tableExists('school_setup_progress'))) return;
  await query(
    `INSERT INTO school_setup_progress (school_id) VALUES ($1) ON CONFLICT (school_id) DO NOTHING`,
    [schoolId]
  );
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
  return computeLiveSetupProgress(schoolId);
}

export async function refreshSetupProgress(schoolId: number): Promise<SetupProgressResponse> {
  completeCache.delete(schoolId);
  return computeLiveSetupProgress(schoolId);
}

export function notifySetupProgressChanged(schoolId: number): void {
  void refreshSetupProgress(schoolId).catch((err) => {
    console.warn('setup progress refresh failed', schoolId, err?.message || err);
  });
}
