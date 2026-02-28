import { apiService } from './api';

export async function listByTerm(termId: number | string) {
    return apiService.get(`/balances/term/${termId}`);
}

export async function getStudentBalance(studentId: number | string, termId: number | string) {
    return apiService.get(`/balances/student/${studentId}/term/${termId}`);
}

export async function updateBalance(studentId: number | string, termId: number | string, data: any) {
    return apiService.put(`/balances/student/${studentId}/term/${termId}`, data);
}

export default { listByTerm, getStudentBalance, updateBalance };
