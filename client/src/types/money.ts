export interface Income {
  id: number;
  amount: number;
  description?: string;
  year?: number;
  meta?: Record<string, any>;
  created_at?: string;
}

export interface Expense {
  id: number;
  amount: number;
  description?: string;
  category?: string;
  year?: number;
  meta?: Record<string, any>;
  created_at?: string;
}
