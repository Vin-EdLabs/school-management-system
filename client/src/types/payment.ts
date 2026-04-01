export interface Payment {
  id: number;
  student_id: number;
  amount: number;
  method?: string;
  term_id?: number | null;
  meta?: Record<string, any>;
  created_at?: string;
}

export interface CreatePaymentPayload {
  student_id: number;
  amount: number;
  method?: string;
  term_id?: number;
}
