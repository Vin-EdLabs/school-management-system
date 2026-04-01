import * as repo from '../repositories/grades.repository.js';

export async function createExamType(payload: any) {
  return repo.createExamType(payload);
}

export async function listExamTypes() {
  return repo.listExamTypes();
}

export async function createExam(payload: any) {
  return repo.createExam(payload);
}

export async function getExam(id: number) {
  return repo.getExamById(id);
}

export async function listExams(filter: any) {
  return repo.listExams(filter);
}

export async function lockExam(id: number, locked: boolean) {
  return repo.lockExam(id, locked);
}

export async function getGrades(examId: number) {
  return repo.getGradesByExam(examId);
}

export async function saveGrades(examId: number, records: any[], userId?: number) {
  return repo.upsertGrades(examId, records, userId);
}

export async function updateGrade(id: number, patch: any, userId?: number) {
  return repo.updateGrade(id, patch, userId);
}

export async function deleteGrade(id: number) {
  return repo.deleteGrade(id);
}

export async function examAnalytics(examId: number) {
  return repo.examAnalytics(examId);
}

export default {
  createExamType,
  listExamTypes,
  createExam,
  getExam,
  listExams,
  lockExam,
  getGrades,
  saveGrades,
  updateGrade,
  deleteGrade,
  examAnalytics
};
