export type StaffLegalDocument = {
  id: string;
  name: string;
  title: string;
  type: string;
  url: string;
  document_number?: string;
  issue_date?: string;
  expiry_date?: string;
  uploaded_at: string;
  file_size?: number;
};

export type OtherStaffRecord = {
  id: number;
  staff_id: string;
  full_name: string;
  gender?: string;
  date_of_birth?: string;
  passport_photo_url?: string;
  phone_number?: string;
  email?: string;
  home_address?: string;
  national_id?: string;
  position?: string;
  department?: string;
  employment_type?: string;
  employment_date?: string;
  monthly_salary?: number;
  ssnit_number?: string;
  ssnit_enabled?: boolean;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_branch?: string;
  bank_account_name?: string;
  employment_status?: string;
  notes?: string;
  qualification?: string;
  specialization?: string;
  counts_as_staff?: boolean;
  documents?: StaffLegalDocument[];
};

export function isDriverPosition(position?: string | null): boolean {
  if (!position) return false;
  const p = position.toLowerCase();
  return (
    p.includes('driver') ||
    p.includes('chauffeur') ||
    p.includes('transport') ||
    p.includes('bus')
  );
}

