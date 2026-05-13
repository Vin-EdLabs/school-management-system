/**
 * Aligns with backend `normalizeSubject` in `backend/src/routes/student.ts`
 * so question-bank rows (stored as keys like `maths`) match composer dropdown
 * labels (e.g. "Mathematics", "English Language").
 */
const SUBJECT_KEY: Record<string, string> = {
  mathematics: 'maths',
  maths: 'maths',
  math: 'maths',
  english: 'english',
  'english language': 'english',
  science: 'science',
  'integrated science': 'science',
  social: 'social',
  'social studies': 'social',
  rme: 'rme',
  french: 'french',
  ict: 'ict',
};

export function normalizeTeacherSubjectKey(value: string | null | undefined): string {
  const s = String(value || '').trim().toLowerCase();
  return SUBJECT_KEY[s] || s;
}

export function teacherSubjectsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeTeacherSubjectKey(a) === normalizeTeacherSubjectKey(b);
}

const KEY_TO_LABEL: Record<string, string> = {
  maths: 'Mathematics',
  english: 'English',
  science: 'Science',
  social: 'Social Studies',
  rme: 'RME',
  french: 'French',
  ict: 'ICT',
};

/** Pretty label for bank/API subject keys (e.g. maths → Mathematics). */
export function teacherSubjectDisplayLabel(key: string | null | undefined): string {
  const k = normalizeTeacherSubjectKey(key);
  return KEY_TO_LABEL[k] || (key ? String(key) : '');
}
