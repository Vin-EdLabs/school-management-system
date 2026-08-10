import { query } from '../db/connection.js';

export type StudentGender = 'male' | 'female';
export type DormGender = 'boys' | 'girls';

export function studentGenderToDormGender(studentGender: string | null | undefined): DormGender | null {
  const g = String(studentGender || '').trim().toLowerCase();
  if (g === 'male' || g === 'm') return 'boys';
  if (g === 'female' || g === 'f') return 'girls';
  return null;
}

export function genderMismatchMessage(studentGender: string, dormGender: string): string {
  const dorm = dormGender === 'boys' ? 'boys' : 'girls';
  if (studentGender === 'male' && dorm === 'girls') {
    return 'Cannot enroll a male student in a girls dormitory';
  }
  if (studentGender === 'female' && dorm === 'boys') {
    return 'Cannot enroll a female student in a boys dormitory';
  }
  return 'Student gender does not match dormitory gender';
}

/** Validate student ↔ dorm gender before enrollment. Returns null if OK, else error message. */
export async function validateEnrollmentGenderMatch(
  studentId: number,
  dormId: number,
  tenantId: number
): Promise<string | null> {
  const result = await query(
    `SELECT LOWER(TRIM(COALESCE(s.gender, ''))) AS student_gender, bd.gender AS dorm_gender
     FROM students s
     CROSS JOIN boarding_dorms bd
     WHERE s.id = $1 AND s.tenant_id = $2 AND bd.id = $3 AND bd.tenant_id = $2`,
    [studentId, tenantId, dormId]
  );
  if (result.rows.length === 0) return 'Student or dorm not found';

  const studentGender = String(result.rows[0].student_gender || '');
  const dormGender = String(result.rows[0].dorm_gender || '');

  if (!studentGender || !['male', 'female'].includes(studentGender)) {
    return 'Student gender must be set before boarding enrollment';
  }
  if (!dormGender) return 'Dormitory gender is not configured';

  const expected = studentGenderToDormGender(studentGender);
  if (expected !== dormGender) {
    return genderMismatchMessage(studentGender, dormGender);
  }
  return null;
}
