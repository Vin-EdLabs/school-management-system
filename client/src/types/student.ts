export interface Student {
  id: number;
  first_name: string;
  last_name: string;
  class_id?: number | null;
  status?: string;
  meta?: Record<string, any>;
  created_at?: string;
}

export interface CreateStudentPayload {
  first_name: string;
  last_name: string;
  admission_no?: string;
}
