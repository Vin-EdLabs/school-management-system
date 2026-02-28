import * as studentsRepo from "../repositories/students.repository.js";

function padSeq(n: number, width = 5) {
  return String(n).padStart(width, "0");
}

export async function createStudent(payload: any) {
  if (!payload.admission_no) {
    // determine year from date_of_admission or current year
    let year: string = "";
    if (payload.date_of_admission) {
      try {
        const d = new Date(payload.date_of_admission);
        if (!isNaN(d.getTime())) year = String(d.getFullYear());
      } catch (e) {
        // ignore and fall back
      }
    }
    if (!year) year = String(new Date().getFullYear());

    const prefix = `ADM${year}`;
    const maxSeq = await studentsRepo.getMaxAdmissionSequence(prefix);
    const next = (maxSeq ? Number(maxSeq) : 0) + 1;
    payload.admission_no = prefix + padSeq(next);
  }

  return studentsRepo.createStudent(payload);
}

export async function getStudent(id: number) {
  return studentsRepo.findStudentById(id);
}

export async function updateStudent(id: number, payload: any) {
  return studentsRepo.updateStudent(id, payload);
}

export async function searchStudents(q: string) {
  return studentsRepo.searchStudents(q);
}

export async function listStudents(limit = 1000) {
  return studentsRepo.listStudents(limit);
}
