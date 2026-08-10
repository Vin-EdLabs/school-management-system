import { apiService } from './api';

// ── Types ────────────────────────────────────────────────────────────────────

export type BoardingGender = 'boys' | 'girls';
export type EnrollmentStatus = 'boarder' | 'day';
export type ExeatStatus = 'pending' | 'approved' | 'rejected' | 'signed_out' | 'returned' | 'overdue';
export type ExeatType = 'exeat' | 'weekend';
export type ComplaintSeverity = 'low' | 'medium' | 'high';
export type ComplaintStatus = 'pending' | 'under_review' | 'resolved';
export type RollCallEntryStatus = 'present' | 'absent';
export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type MealStatus = 'present' | 'absent';
export type SickBayStatus = 'resting' | 'sent_home' | 'recovered';

export interface BoardingActivityItem {
  id: string | number;
  type: string;
  description: string;
  created_at: string;
  student_name?: string;
}

export interface BoardingOverviewStats {
  total_boarders: number;
  boys_count: number;
  girls_count: number;
  total_beds: number;
  occupied_beds: number;
  vacant_beds: number;
  pending_exeats: number;
  overdue_exeats: number;
  open_complaints?: number;
  todays_roll_call_done: boolean;
  sick_bay_active_count: number;
  recent_activity: BoardingActivityItem[];
  dorm_layout?: {
    boys: DormLayoutSection[];
    girls: DormLayoutSection[];
  };
}

export type DormLayoutSection = {
  dorm_id: number;
  dorm_name: string;
  gender: string;
  rooms: Array<{
    id: number;
    room_name: string;
    beds: Array<{
      id: number;
      bed_number: string;
      is_occupied: boolean;
      student: {
        id: number;
        first_name: string;
        last_name: string;
        class_name: string | null;
        passport_photo_url: string | null;
        outstanding: number;
        on_exeat: boolean;
        in_sick_bay: boolean;
      } | null;
    }>;
  }>;
};

export interface BoardingDorm {
  id: number;
  name: string;
  gender: BoardingGender | null;
  created_at?: string;
  room_count?: number;
  total_beds?: number;
  occupied_beds?: number;
}

export interface BoardingRoom {
  id: number;
  dorm_id: number;
  room_name: string;
  capacity: number;
  created_at?: string;
  occupied_count?: number;
  beds?: BoardingBed[];
}

export interface BoardingBed {
  id: number;
  room_id: number;
  bed_number: string;
  is_occupied: boolean;
  student_name?: string | null;
  student_id?: number | null;
}

export interface BoardingEnrollment {
  id: number;
  tenant_id?: number;
  student_id: number;
  term_id: number;
  status: EnrollmentStatus;
  dorm_id: number | null;
  room_id: number | null;
  bed_id: number | null;
  start_date: string | null;
  end_date: string | null;
  converted_from: string | null;
  created_at?: string;
  first_name?: string;
  last_name?: string;
  student_code?: string;
  admission_number?: string;
  class_name?: string;
  class_id?: number;
  dorm_name?: string;
  room_name?: string;
  bed_number?: string;
  gender?: string;
  boarding_fee_configured?: number | string | null;
  boarding_fee_applied?: number | string | null;
}

export interface BoardingFeePreview {
  student_id: number;
  term_id: number;
  configured_amount: number;
  configured_lodging?: number;
  configured_feeding?: number;
  applied_amount: number;
  applied_lodging?: number;
  applied_feeding?: number;
  is_configured: boolean;
  is_applied: boolean;
}

export interface BoardingTermFeeSetting {
  term_id: number;
  amount: number;
  lodging_amount: number;
  feeding_amount: number;
  fee_mode?: 'same' | 'by_gender';
  boys_lodging_amount?: number;
  boys_feeding_amount?: number;
  girls_lodging_amount?: number;
  girls_feeding_amount?: number;
  is_active: boolean;
  is_configured: boolean;
}

export interface BoardingExeat {
  id: number;
  student_id: number;
  guardian_name: string | null;
  guardian_phone?: string | null;
  destination: string | null;
  departure_date: string | null;
  return_date: string | null;
  actual_return_date: string | null;
  type?: ExeatType;
  status: ExeatStatus;
  notes: string | null;
  created_at?: string;
  first_name?: string;
  last_name?: string;
  student_code?: string;
  class_name?: string;
  dorm_name?: string;
}

export interface BoardingRollCall {
  id: number;
  dorm_id: number | null;
  roll_call_date: string;
  created_by?: number | null;
  created_at?: string;
  dorm_name?: string;
  entry_count?: number;
  present_count?: number;
  absent_count?: number;
}

export interface BoardingRollCallEntry {
  id: number;
  roll_call_id: number;
  student_id: number;
  status: RollCallEntryStatus;
  flagged: boolean;
  note: string | null;
  first_name?: string;
  last_name?: string;
  student_code?: string;
  class_name?: string;
  bed_number?: string;
}

export interface BoardingMealRecord {
  id?: number;
  student_id: number;
  meal_date: string;
  meal_type: MealType;
  status: MealStatus;
  first_name?: string;
  last_name?: string;
  student_code?: string;
  class_name?: string;
  dorm_name?: string;
}

export interface BoardingSickBayRecord {
  id: number;
  student_id: number;
  reported_date: string;
  symptoms: string | null;
  action_taken: string | null;
  status: SickBayStatus;
  resolved_date: string | null;
  created_at?: string;
  first_name?: string;
  last_name?: string;
  student_code?: string;
  class_name?: string;
  dorm_name?: string;
}

export interface WeeklyMenuItem {
  day_of_week: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  meal_type: MealType;
  menu_item: string;
}

export interface WeeklyMenu {
  items: WeeklyMenuItem[];
}

export interface StudentBoardingSummary {
  enrollment: BoardingEnrollment | null;
  recent_exeats: BoardingExeat[];
  sick_bay_records: BoardingSickBayRecord[];
  roll_call_summary?: { present: number; absent: number; flagged: number };
  weekly_menu?: WeeklyMenu;
  complaints?: BoardingComplaint[];
}

export interface BoardingComplaint {
  id: number;
  student_id: number;
  title: string;
  description: string;
  parent_summary?: string | null;
  severity: ComplaintSeverity;
  status: ComplaintStatus;
  resolution_note?: string | null;
  created_at?: string;
  first_name?: string;
  last_name?: string;
  class_name?: string;
  filed_by_name?: string;
}

export interface CreateComplaintPayload {
  student_id: number;
  title: string;
  description: string;
  severity?: ComplaintSeverity;
}

export interface UpdateComplaintPayload {
  status?: ComplaintStatus;
  resolution_note?: string;
}

export interface BoardingFinanceBoarder {
  student_id: number;
  first_name?: string;
  last_name?: string;
  class_name?: string;
  dorm_name?: string;
  boarding_fee: number;
  amount_paid: number;
  outstanding: number;
  payment_status: 'Paid' | 'Partial' | 'Unpaid';
}

export interface BoardingFinanceResponse {
  term_id: number;
  summary: {
    total_expected: number;
    total_collected: number;
    total_outstanding: number;
    fully_paid: number;
    partial: number;
    unpaid: number;
    boarder_count: number;
  };
  boarders: BoardingFinanceBoarder[];
}

export interface PrintHouseListData {
  school_name: string;
  logo_url?: string | null;
  term_name: string;
  year_name: string;
  generated_at: string;
  males: {
    total: number;
    dorms: Array<{
      dorm_id: number;
      dorm_name: string;
      rooms: Array<{
        room_name: string;
        beds: Array<{
          bed_number: string;
          student_name: string | null;
          class_name: string | null;
        }>;
      }>;
    }>;
  };
  females: {
    total: number;
    dorms: Array<{
      dorm_id: number;
      dorm_name: string;
      rooms: Array<{
        room_name: string;
        beds: Array<{
          bed_number: string;
          student_name: string | null;
          class_name: string | null;
        }>;
      }>;
    }>;
  };
  summary: {
    total_boarders: number;
    males_count: number;
    females_count: number;
    total_beds: number;
    occupied_beds: number;
    vacant_beds: number;
  };
}

export interface BoardingComplaintsListResponse {
  items: BoardingComplaint[];
  summary: {
    total: number;
    pending: number;
    under_review: number;
    resolved: number;
    high_severity: number;
  };
  can_resolve: boolean;
  can_file: boolean;
}

export interface BoardingRolloverResult {
  students_carried: number;
  skipped: number;
  errors: string[];
}

export interface BoardingBedHistoryEntry {
  id: number;
  bed_id: number;
  student_id: number;
  assigned_date: string | null;
  vacated_date: string | null;
  reason: string | null;
  first_name?: string;
  last_name?: string;
  term_name?: string;
}

export interface CreateEnrollmentPayload {
  student_id: number;
  status: EnrollmentStatus;
  dorm_id?: number | null;
  room_id?: number | null;
  bed_id?: number | null;
  start_date?: string | null;
  term_id?: number;
}

export interface ConvertEnrollmentPayload {
  status: EnrollmentStatus;
  dorm_id?: number | null;
  room_id?: number | null;
  bed_id?: number | null;
  start_date?: string | null;
}

export interface CreateExeatPayload {
  student_id: number;
  type?: ExeatType;
  guardian_name?: string;
  guardian_phone?: string;
  destination?: string;
  departure_date?: string;
  return_date?: string;
  notes?: string;
}

export interface CreateRollCallPayload {
  dorm_id?: number | null;
  roll_call_date: string;
}

export interface RollCallEntryInput {
  student_id: number;
  status: RollCallEntryStatus;
  flagged?: boolean;
  note?: string;
}

export interface FeedingEntryInput {
  student_id: number;
  meal_date: string;
  meal_type: MealType;
  status: MealStatus;
}

export interface CreateSickBayPayload {
  student_id: number;
  reported_date: string;
  symptoms?: string;
  action_taken?: string;
  status?: SickBayStatus;
}

export interface UpdateSickBayPayload {
  symptoms?: string;
  action_taken?: string;
  status?: SickBayStatus;
  resolved_date?: string | null;
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val != null && val !== '') qs.set(key, String(val));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// ── Service ──────────────────────────────────────────────────────────────────

export const boardingService = {
  async getOverview(): Promise<BoardingOverviewStats> {
    return apiService.get('/boarding/overview');
  },

  async getDormLayout(): Promise<{ boys: DormLayoutSection[]; girls: DormLayoutSection[] }> {
    return apiService.get('/boarding/dorm-layout');
  },

  // Dorms
  async listDorms(): Promise<BoardingDorm[]> {
    return apiService.get('/boarding/dorms');
  },

  async createDorm(payload: { name: string; gender?: BoardingGender | null }): Promise<BoardingDorm> {
    return apiService.post('/boarding/dorms', payload);
  },

  async updateDorm(id: number, payload: { name?: string; gender?: BoardingGender | null }): Promise<BoardingDorm> {
    return apiService.put(`/boarding/dorms/${id}`, payload);
  },

  async deleteDorm(id: number): Promise<void> {
    return apiService.delete(`/boarding/dorms/${id}`);
  },

  // Rooms
  async listRooms(dormId: number): Promise<BoardingRoom[]> {
    return apiService.get(`/boarding/dorms/${dormId}/rooms`);
  },

  async createRoom(dormId: number, payload: { room_name: string; capacity: number }): Promise<BoardingRoom> {
    return apiService.post(`/boarding/dorms/${dormId}/rooms`, payload);
  },

  async updateRoom(id: number, payload: { room_name?: string; capacity?: number }): Promise<BoardingRoom> {
    return apiService.put(`/boarding/rooms/${id}`, payload);
  },

  async deleteRoom(id: number): Promise<void> {
    return apiService.delete(`/boarding/rooms/${id}`);
  },

  // Beds
  async listBeds(roomId: number): Promise<BoardingBed[]> {
    return apiService.get(`/boarding/rooms/${roomId}/beds`);
  },

  async createBed(roomId: number, payload: { bed_number: string }): Promise<BoardingBed> {
    return apiService.post(`/boarding/rooms/${roomId}/beds`, payload);
  },

  async updateBed(id: number, payload: { bed_number?: string }): Promise<BoardingBed> {
    return apiService.put(`/boarding/beds/${id}`, payload);
  },

  async deleteBed(id: number): Promise<void> {
    return apiService.delete(`/boarding/beds/${id}`);
  },

  // Enrollments
  async listEnrollments(params?: { term_id?: number; dorm_id?: number; class_id?: number }): Promise<BoardingEnrollment[]> {
    return apiService.get(`/boarding/enrollments${buildQuery(params ?? {})}`);
  },

  async createEnrollment(payload: CreateEnrollmentPayload): Promise<BoardingEnrollment> {
    return apiService.post('/boarding/enrollments', payload);
  },

  async convertEnrollment(id: number, payload: ConvertEnrollmentPayload): Promise<BoardingEnrollment> {
    return apiService.put(`/boarding/enrollments/${id}/convert`, payload);
  },

  async deleteEnrollment(id: number): Promise<void> {
    return apiService.delete(`/boarding/enrollments/${id}`);
  },

  async previewBoardingFee(studentId: number | string): Promise<BoardingFeePreview> {
    return apiService.get(`/boarding/fees/preview?student_id=${encodeURIComponent(String(studentId))}`);
  },

  async getTermBoardingFee(): Promise<BoardingTermFeeSetting> {
    return apiService.get('/fees/boarding-term');
  },

  async saveTermBoardingFee(payload: {
    lodging_amount: number;
    feeding_amount: number;
    fee_mode?: 'same' | 'by_gender';
    boys_lodging_amount?: number;
    boys_feeding_amount?: number;
    girls_lodging_amount?: number;
    girls_feeding_amount?: number;
  }): Promise<BoardingTermFeeSetting> {
    return apiService.put('/fees/boarding-term', {
      lodging_amount: payload.lodging_amount,
      feeding_amount: payload.feeding_amount,
      fee_mode: payload.fee_mode ?? 'same',
      boys_lodging_amount: payload.boys_lodging_amount ?? 0,
      boys_feeding_amount: payload.boys_feeding_amount ?? 0,
      girls_lodging_amount: payload.girls_lodging_amount ?? 0,
      girls_feeding_amount: payload.girls_feeding_amount ?? 0,
      is_active: true,
    });
  },

  async syncBoardingFees(termId?: number): Promise<{
    termId: number;
    applied: number;
    removed: number;
    flagged: number;
    skipped: number;
    warnings: string[];
  }> {
    return apiService.post('/boarding/sync-fees', termId != null ? { term_id: termId } : {});
  },

  // Exeats
  async listExeats(params?: { status?: ExeatStatus }): Promise<BoardingExeat[]> {
    return apiService.get(`/boarding/exeats${buildQuery(params ?? {})}`);
  },

  async createExeat(payload: CreateExeatPayload): Promise<BoardingExeat> {
    return apiService.post('/boarding/exeats', payload);
  },

  async approveExeat(id: number): Promise<BoardingExeat> {
    return apiService.put(`/boarding/exeats/${id}/approve`, {});
  },

  async rejectExeat(id: number, notes?: string): Promise<BoardingExeat> {
    return apiService.put(`/boarding/exeats/${id}/reject`, { notes });
  },

  async signOutExeat(id: number): Promise<BoardingExeat> {
    return apiService.put(`/boarding/exeats/${id}/signout`, {});
  },

  async returnExeat(id: number, actual_return_date?: string): Promise<BoardingExeat> {
    return apiService.put(`/boarding/exeats/${id}/return`, { actual_return_date });
  },

  // Roll call
  async listRollCalls(params?: { date?: string; dorm_id?: number }): Promise<BoardingRollCall[]> {
    return apiService.get(`/boarding/rollcall${buildQuery(params ?? {})}`);
  },

  async createRollCall(payload: CreateRollCallPayload): Promise<BoardingRollCall> {
    return apiService.post('/boarding/rollcall', payload);
  },

  async getRollCallEntries(rollCallId: number): Promise<BoardingRollCallEntry[]> {
    return apiService.get(`/boarding/rollcall/${rollCallId}/entries`);
  },

  async saveRollCallEntries(rollCallId: number, entries: RollCallEntryInput[]): Promise<BoardingRollCallEntry[]> {
    return apiService.post(`/boarding/rollcall/${rollCallId}/entries`, { entries });
  },

  // Feeding — weekly menu
  async getWeeklyMenu(): Promise<WeeklyMenu> {
    return apiService.get('/boarding/feeding/menu');
  },

  async saveWeeklyMenu(payload: WeeklyMenu): Promise<WeeklyMenu> {
    return apiService.put('/boarding/feeding/menu', payload);
  },

  // Sick bay
  async listSickBay(params?: { status?: SickBayStatus }): Promise<BoardingSickBayRecord[]> {
    return apiService.get(`/boarding/sickbay${buildQuery(params ?? {})}`);
  },

  async createSickBay(payload: CreateSickBayPayload): Promise<BoardingSickBayRecord> {
    return apiService.post('/boarding/sickbay', payload);
  },

  async updateSickBay(id: number, payload: UpdateSickBayPayload): Promise<BoardingSickBayRecord> {
    return apiService.put(`/boarding/sickbay/${id}`, payload);
  },

  // Student profile tab
  async getStudentSummary(studentId: string | number): Promise<StudentBoardingSummary> {
    return apiService.get(`/boarding/students/${studentId}/summary`);
  },

  async listComplaints(params?: { status?: 'active' | 'resolved'; search?: string }): Promise<BoardingComplaintsListResponse> {
    return apiService.get(`/boarding/complaints${buildQuery(params ?? {})}`);
  },

  async getComplaint(id: number): Promise<BoardingComplaint> {
    return apiService.get(`/boarding/complaints/${id}`);
  },

  async createComplaint(payload: CreateComplaintPayload): Promise<BoardingComplaint> {
    return apiService.post('/boarding/complaints', payload);
  },

  async updateComplaintStatus(id: number, payload: { status: 'under_review' | 'resolved'; note?: string }): Promise<BoardingComplaint> {
    return apiService.patch(`/boarding/complaints/${id}/status`, payload);
  },

  async getBoardingFinance(termId?: number): Promise<BoardingFinanceResponse> {
    return apiService.get(`/boarding/finance${buildQuery({ term_id: termId })}`);
  },

  async getPrintHouseList(termId?: number): Promise<PrintHouseListData> {
    return apiService.get(`/boarding/print/houselist${buildQuery({ term_id: termId })}`);
  },

  async listOverdueExeats(): Promise<BoardingExeat[]> {
    return apiService.get('/boarding/exeats/overdue');
  },

  async rolloverBoarders(fromTermId: number, toTermId: number): Promise<BoardingRolloverResult> {
    return apiService.post('/boarding/rollover', { fromTermId, toTermId });
  },

  async getBedHistory(bedId: number): Promise<BoardingBedHistoryEntry[]> {
    return apiService.get(`/boarding/beds/${bedId}/history`);
  },
};

export async function toggleSuperAdminBoarding(
  schoolId: number,
  enabled: boolean
): Promise<{ id: number; boarding_enabled: boolean }> {
  return apiService.patch(`/super-admin/schools/${schoolId}/toggle-boarding`, { enabled });
}
