export type FieldRule = {
  id: string;
  label: string;
  sectionId?: string;
  isInvalid: () => boolean;
  message?: string;
};

export type FormValidationResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string>; firstFieldId: string; firstSectionId?: string; summary: string };

export function validateFormFields(rules: FieldRule[]): FormValidationResult {
  const errors: Record<string, string> = {};
  let firstFieldId = '';
  let firstSectionId: string | undefined;

  for (const rule of rules) {
    if (!rule.isInvalid()) continue;
    errors[rule.id] = rule.message || `${rule.label} is required`;
    if (!firstFieldId) {
      firstFieldId = rule.id;
      firstSectionId = rule.sectionId;
    }
  }

  if (!firstFieldId) return { ok: true };

  const messages = Object.values(errors);
  const summary =
    messages.length === 1
      ? messages[0]
      : `Please complete the following: ${messages.join('; ')}`;

  return { ok: false, errors, firstFieldId, firstSectionId, summary };
}

export function scrollToFormField(fieldId: string, sectionId?: string) {
  if (sectionId) {
    const section = document.getElementById(sectionId);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.setTimeout(() => {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      el.focus({ preventScroll: true });
    } else {
      const focusable = el.querySelector<HTMLElement>(
        'input, textarea, select, button[role="combobox"], [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus({ preventScroll: true });
    }
  }, sectionId ? 120 : 0);
}

export function fieldInvalidClass(hasError: boolean): string {
  return hasError ? 'border-destructive ring-2 ring-destructive/40 focus-visible:ring-destructive/50' : '';
}

import type { Dispatch, SetStateAction } from 'react';

export function clearFieldError(
  errors: Record<string, string>,
  fieldId: string,
  setErrors: Dispatch<SetStateAction<Record<string, string>>>
) {
  if (!errors[fieldId]) return;
  setErrors((prev) => {
    const next = { ...prev };
    delete next[fieldId];
    return next;
  });
}

export function getTeacherValidationRules(formData: {
  fullName: string;
  gender: string;
  email: string;
  phoneNumber: string;
}): FieldRule[] {
  return [
    {
      id: 'teacher-fullName',
      label: 'Full name',
      sectionId: 'teacher-personal',
      isInvalid: () => !formData.fullName.trim(),
      message: 'Full name is required',
    },
    {
      id: 'teacher-gender',
      label: 'Gender',
      sectionId: 'teacher-personal',
      isInvalid: () => !formData.gender.trim(),
      message: 'Gender is required',
    },
    {
      id: 'teacher-email',
      label: 'Email',
      sectionId: 'teacher-personal',
      isInvalid: () => !formData.email.trim(),
      message: 'Email is required',
    },
    {
      id: 'teacher-phoneNumber',
      label: 'Phone number',
      sectionId: 'teacher-personal',
      isInvalid: () => !formData.phoneNumber.trim(),
      message: 'Phone number is required',
    },
  ];
}

export function getOtherStaffValidationRules(form: {
  full_name: string;
  position: string;
  department: string;
}): FieldRule[] {
  return [
    {
      id: 'other-staff-full-name',
      label: 'Full name',
      sectionId: 'other-staff-personal',
      isInvalid: () => !form.full_name.trim(),
      message: 'Full name is required',
    },
    {
      id: 'other-staff-position',
      label: 'Position',
      sectionId: 'other-staff-employment',
      isInvalid: () => !form.position.trim(),
      message: 'Position is required — select or type a position',
    },
    {
      id: 'other-staff-department',
      label: 'Department',
      sectionId: 'other-staff-employment',
      isInvalid: () => !form.department.trim(),
      message: 'Department is required — select or type a department',
    },
  ];
}

export function getStudentValidationRules(
  formData: {
    firstName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    nationality: string;
    classAssigned: string;
    dateOfAdmission: string;
    guardianName: string;
    guardianContact: string;
    homeAddress: string;
  },
  options?: { requiresClass?: boolean }
): FieldRule[] {
  const requiresClass = options?.requiresClass !== false;
  const rules: FieldRule[] = [
    {
      id: 'firstName',
      label: 'First name',
      sectionId: 'student-personal',
      isInvalid: () => !formData.firstName.trim(),
      message: 'First name is required',
    },
    {
      id: 'lastName',
      label: 'Last name',
      sectionId: 'student-personal',
      isInvalid: () => !formData.lastName.trim(),
      message: 'Last name is required',
    },
    {
      id: 'gender',
      label: 'Gender',
      sectionId: 'student-personal',
      isInvalid: () => !formData.gender.trim(),
      message: 'Gender is required',
    },
    {
      id: 'dateOfBirth',
      label: 'Date of birth',
      sectionId: 'student-personal',
      isInvalid: () => !formData.dateOfBirth.trim(),
      message: 'Date of birth is required',
    },
    {
      id: 'nationality',
      label: 'Nationality',
      sectionId: 'student-personal',
      isInvalid: () => !formData.nationality.trim(),
      message: 'Nationality is required',
    },
  ];

  if (requiresClass) {
    rules.push({
      id: 'classAssigned',
      label: 'Class',
      sectionId: 'student-enrollment',
      isInvalid: () => !formData.classAssigned.trim(),
      message: 'Class is required',
    });
  }

  rules.push(
    {
      id: 'dateOfAdmission',
      label: 'Onboarding date',
      sectionId: 'student-enrollment',
      isInvalid: () => !formData.dateOfAdmission.trim(),
      message: 'Onboarding date is required',
    },
    {
      id: 'guardianName',
      label: 'Guardian name',
      sectionId: 'student-guardian',
      isInvalid: () => !formData.guardianName.trim(),
      message: 'Guardian name is required',
    },
    {
      id: 'guardianContact',
      label: 'Guardian contact',
      sectionId: 'student-guardian',
      isInvalid: () => !formData.guardianContact.trim(),
      message: 'Guardian contact is required',
    },
    {
      id: 'homeAddress',
      label: 'Home address',
      sectionId: 'student-guardian',
      isInvalid: () => !formData.homeAddress.trim(),
      message: 'Home address is required',
    }
  );

  return rules;
}
