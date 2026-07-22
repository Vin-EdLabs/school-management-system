import { apiService } from './api';

export type TimetableDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export interface Period {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  order_index: number;
  is_break?: boolean;
}

export interface ClassSlot {
  id: number;
  class_id: number;
  term_id: number;
  day_of_week: TimetableDay;
  period_id: number;
  subject_id: number;
  teacher_id: number | null;
  subject_name?: string;
  teacher_name?: string;
  class_name?: string;
}

export interface ClassTeachingAssignment {
  teacher_id: number;
  teacher_name: string;
  subject_id: number;
  subject_name: string;
}

export interface ClassTimetableGrid {
  days: TimetableDay[];
  periods: Period[];
  slots: ClassSlot[];
}

export interface ExamEntry {
  id: number;
  class_id: number;
  term_id: number;
  subject_id: number;
  exam_date: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  notes: string | null;
  subject_name?: string;
  class_name?: string;
}

export interface TeacherConflict {
  teacher_id: number;
  teacher_name: string;
  class_id: number;
  class_name: string;
  day_of_week: TimetableDay;
  period_id: number;
}

export interface LedgerTerm {
  id: number;
  name: string;
  is_current?: boolean;
  academic_year_name?: string;
}

export async function fetchPeriods(): Promise<Period[]> {
  return apiService.get<Period[]>('/timetable/periods');
}

export async function createPeriod(payload: {
  name: string;
  start_time: string;
  end_time: string;
  order_index?: number;
  is_break?: boolean;
}): Promise<Period> {
  return apiService.post<Period>('/timetable/periods', payload);
}

export async function addTimetableColumn(classId: number, termId: number): Promise<Period> {
  return apiService.post<Period>('/timetable/periods/add-column', { class_id: classId, term_id: termId });
}

export async function updatePeriod(id: number, payload: Partial<Period>): Promise<Period> {
  return apiService.put<Period>(`/timetable/periods/${id}`, payload);
}

export async function deletePeriod(id: number): Promise<void> {
  await apiService.delete(`/timetable/periods/${id}`);
}

export async function fetchClassTimetable(classId: number, termId: number): Promise<ClassTimetableGrid> {
  return apiService.get<ClassTimetableGrid>(`/timetable/class/${classId}?term_id=${termId}`);
}

export async function saveClassSlot(payload: {
  class_id: number;
  term_id: number;
  day_of_week: TimetableDay;
  period_id: number;
  subject_id: number;
  teacher_id?: number | null;
  force?: boolean;
}): Promise<ClassSlot> {
  return apiService.post<ClassSlot>('/timetable/class', payload);
}

export async function updateClassSlot(
  id: number,
  payload: { subject_id?: number; teacher_id?: number | null; force?: boolean }
): Promise<ClassSlot> {
  return apiService.put<ClassSlot>(`/timetable/class/${id}`, payload);
}

export async function deleteClassSlot(id: number): Promise<void> {
  await apiService.delete(`/timetable/class/${id}`);
}

export async function copyClassTimetable(payload: {
  class_id: number;
  from_term_id: number;
  to_term_id: number;
}): Promise<{ copied: number }> {
  return apiService.post('/timetable/class/copy', payload);
}

export async function fetchTeacherTimetable(teacherId: number, termId: number): Promise<ClassTimetableGrid & { teacher?: { id: number; full_name: string } }> {
  return apiService.get(`/timetable/teacher/${teacherId}?term_id=${termId}`);
}

export async function fetchSubjectTeachers(subjectId: number, classId: number): Promise<Array<{ id: number; full_name: string }>> {
  return apiService.get(`/timetable/subject-teachers?subject_id=${subjectId}&class_id=${classId}`);
}

export async function fetchClassTeachingAssignments(classId: number): Promise<ClassTeachingAssignment[]> {
  return apiService.get(`/timetable/class-assignments?class_id=${classId}`);
}

export async function fetchExams(termId: number, classId?: number): Promise<ExamEntry[]> {
  const q = classId ? `?term_id=${termId}&class_id=${classId}` : `?term_id=${termId}`;
  return apiService.get<ExamEntry[]>(`/timetable/exam${q}`);
}

export async function createExam(payload: {
  class_id: number;
  term_id: number;
  subject_id: number;
  exam_date: string;
  start_time: string;
  end_time: string;
  venue?: string;
  notes?: string;
}): Promise<ExamEntry> {
  return apiService.post<ExamEntry>('/timetable/exam', payload);
}

export async function updateExam(id: number, payload: Partial<{
  class_id: number;
  term_id: number;
  subject_id: number;
  exam_date: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  notes: string | null;
}>): Promise<ExamEntry> {
  return apiService.put<ExamEntry>(`/timetable/exam/${id}`, payload);
}

export async function deleteExam(id: number): Promise<void> {
  await apiService.delete(`/timetable/exam/${id}`);
}

export async function fetchTeacherExams(teacherId: number, termId: number): Promise<{ teacher: { id: number; full_name: string }; exams: ExamEntry[] }> {
  return apiService.get(`/timetable/exam/teacher/${teacherId}?term_id=${termId}`);
}

export async function fetchLedgerTerms(): Promise<LedgerTerm[]> {
  return apiService.get<LedgerTerm[]>('/finance/terms').catch(() => []);
}
