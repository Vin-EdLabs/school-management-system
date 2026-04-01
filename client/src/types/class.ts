export interface SchoolClass {
  id: number;
  name: string;
  teacher_id?: number | null;
  meta?: Record<string, any>;
  created_at?: string;
}
