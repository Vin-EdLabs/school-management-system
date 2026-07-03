import type { Student } from '@/contexts/DataContext';

export const formatDateForInput = (date: unknown): string => {
  if (!date) return '';
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  try {
    const d = new Date(date as string);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

export const mapStudent = (backendStudent: Record<string, unknown>): Student => ({
  id: String(backendStudent.id),
  firstName: backendStudent.first_name as string,
  lastName: backendStudent.last_name as string,
  gender: (backendStudent.gender as string) || '',
  dateOfBirth: formatDateForInput(backendStudent.date_of_birth),
  nationality: (backendStudent.nationality as string) || '',
  studentId: backendStudent.student_id as string,
  admissionNumber: backendStudent.admission_number as string,
  classAssigned: (backendStudent.class_name as string) || '',
  classAssignedId:
    backendStudent.class_assigned_id != null
      ? Number(backendStudent.class_assigned_id)
      : backendStudent.resolved_class_id != null
        ? Number(backendStudent.resolved_class_id)
        : undefined,
  guardianName: (backendStudent.guardian_name as string) || '',
  guardianContact: (backendStudent.guardian_contact as string) || '',
  guardian2Name: (backendStudent.guardian_2_name as string) || '',
  guardian2Contact: (backendStudent.guardian_2_contact as string) || '',
  guardian2Relationship: (backendStudent.guardian_2_relationship as string) || '',
  homeAddress: (backendStudent.home_address as string) || '',
  numberOfSiblings: Number(backendStudent.number_of_siblings) || 0,
  namesOfSiblings: (backendStudent.names_of_siblings as string) || '',
  previousSchool: (backendStudent.previous_school as string) || '',
  dateOfAdmission: formatDateForInput(backendStudent.date_of_admission),
  notes: (backendStudent.notes as string) || '',
  passportPhotoUrl: (backendStudent.passport_photo_url as string) || undefined,
  hasPassportPhoto:
    backendStudent.has_passport_photo != null
      ? Boolean(backendStudent.has_passport_photo)
      : !!(backendStudent.passport_photo_url as string),
  isBeneficiary: !!backendStudent.is_beneficiary,
  beneficiaryType: (backendStudent.beneficiary_type as string) || '',
  ...(() => {
    const isBen = !!backendStudent.is_beneficiary;
    const rawType =
      backendStudent.discount_type != null ? String(backendStudent.discount_type).trim() : '';
    if (isBen) {
      if (!rawType) {
        return { discountType: 'percentage' as const, discountValue: 100 };
      }
      const discountType = rawType === 'fixed' ? ('fixed' as const) : ('percentage' as const);
      const discountValue =
        backendStudent.discount_value != null && backendStudent.discount_value !== ''
          ? parseFloat(String(backendStudent.discount_value))
          : discountType === 'percentage'
            ? 100
            : 0;
      return {
        discountType,
        discountValue: Number.isFinite(discountValue) ? discountValue : discountType === 'percentage' ? 100 : 0,
      };
    }
    return {
      discountType: backendStudent.discount_type != null ? (backendStudent.discount_type as 'percentage' | 'fixed') : undefined,
      discountValue:
        backendStudent.discount_value != null && backendStudent.discount_value !== ''
          ? parseFloat(String(backendStudent.discount_value))
          : 0,
    };
  })(),
  beneficiaryNotes: (backendStudent.beneficiary_notes as string) || '',
  enrollmentStatus: ((backendStudent.enrollment_status as string) || 'active').toLowerCase(),
  graduatedAt: backendStudent.graduated_at ? formatDateForInput(backendStudent.graduated_at) : undefined,
  admissionAcademicTermId:
    backendStudent.admission_academic_term_id != null
      ? Number(backendStudent.admission_academic_term_id)
      : null,
  inactivatedAt: formatDateForInput(backendStudent.inactivated_at),
  inactivatedAcademicTermId:
    backendStudent.inactivated_academic_term_id != null
      ? Number(backendStudent.inactivated_academic_term_id)
      : null,
  createdAt: typeof backendStudent.created_at === 'string' ? backendStudent.created_at : undefined,
});

export const mapStudentToBackend = (student: Partial<Student>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (student.firstName !== undefined) out.first_name = student.firstName;
  if (student.lastName !== undefined) out.last_name = student.lastName;
  if (student.gender !== undefined) out.gender = student.gender;
  if (student.dateOfBirth !== undefined) out.date_of_birth = student.dateOfBirth;
  if (student.nationality !== undefined) out.nationality = student.nationality;
  if (student.classAssignedId !== undefined) out.class_assigned_id = student.classAssignedId;
  if (student.guardianName !== undefined) out.guardian_name = student.guardianName;
  if (student.guardianContact !== undefined) out.guardian_contact = student.guardianContact;
  if (student.guardian2Name !== undefined) out.guardian_2_name = student.guardian2Name;
  if (student.guardian2Contact !== undefined) out.guardian_2_contact = student.guardian2Contact;
  if (student.guardian2Relationship !== undefined) out.guardian_2_relationship = student.guardian2Relationship;
  if (student.homeAddress !== undefined) out.home_address = student.homeAddress;
  if (student.numberOfSiblings !== undefined) out.number_of_siblings = student.numberOfSiblings;
  if (student.namesOfSiblings !== undefined) out.names_of_siblings = student.namesOfSiblings;
  if (student.previousSchool !== undefined) out.previous_school = student.previousSchool;
  if (student.dateOfAdmission !== undefined) out.date_of_admission = student.dateOfAdmission;
  if (student.notes !== undefined) out.notes = student.notes;
  if (student.passportPhotoUrl !== undefined) out.passport_photo_url = student.passportPhotoUrl;
  if (student.isBeneficiary !== undefined) out.is_beneficiary = student.isBeneficiary;
  if (student.beneficiaryType !== undefined) out.beneficiary_type = student.isBeneficiary ? student.beneficiaryType ?? null : null;
  if (student.discountType !== undefined) out.discount_type = student.isBeneficiary ? student.discountType ?? null : null;
  if (student.discountValue !== undefined) out.discount_value = student.isBeneficiary ? student.discountValue ?? null : null;
  if (student.beneficiaryNotes !== undefined) out.beneficiary_notes = student.beneficiaryNotes;
  if (student.enrollmentStatus !== undefined) out.enrollment_status = student.enrollmentStatus;
  return out;
};
