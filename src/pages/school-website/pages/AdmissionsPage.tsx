import React, { useMemo, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, FileText, Loader2, UploadCloud, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormFieldError, FormValidationSummary } from '@/components/common/FormFieldError';
import { cn } from '@/lib/utils';
import {
  clearFieldError,
  fieldInvalidClass,
  scrollToFormField,
  validateFormFields,
  type FieldRule,
} from '@/utils/formValidation';
import { schoolWebsitePublicService } from '@/services/schoolWebsiteService';
import { useSchoolWebsite } from '../SchoolWebsiteContext';
import { PageHero, Reveal } from '../SchoolWebsiteLayout';
import ApplicationSuccessScreen from '../components/ApplicationSuccessScreen';
import ApplicationsClosedNotice from '../components/ApplicationsClosedNotice';
import { getApplicationWindowStatus } from '../utils/applicationWindow';

type Doc = { name: string; url: string; type: string; label?: string };

const STEPS = ['Personal', 'School', 'Guardian', 'Documents', 'Review'];

const INITIAL = {
  firstName: '',
  lastName: '',
  gender: '',
  dateOfBirth: '',
  nationality: 'Ghanaian',
  classAssigned: '',
  previousSchool: '',
  dateOfAdmission: new Date().toISOString().split('T')[0],
  guardianName: '',
  guardianContact: '',
  guardianEmail: '',
  guardian2Name: '',
  guardian2Contact: '',
  guardian2Relationship: '',
  homeAddress: '',
  numberOfSiblings: 0,
  namesOfSiblings: '',
  notes: '',
  documents: [] as Doc[],
};

const SW_FIELD = 'sw-field h-11 w-full';

function stepRules(form: typeof INITIAL, step: number): FieldRule[] {
  if (step === 0) {
    return [
      { id: 'firstName', label: 'First name', sectionId: 'adm-personal', isInvalid: () => !form.firstName.trim() },
      { id: 'lastName', label: 'Last name', sectionId: 'adm-personal', isInvalid: () => !form.lastName.trim() },
      { id: 'gender', label: 'Gender', sectionId: 'adm-personal', isInvalid: () => !form.gender.trim() },
      { id: 'dateOfBirth', label: 'Date of birth', sectionId: 'adm-personal', isInvalid: () => !form.dateOfBirth.trim() },
      { id: 'nationality', label: 'Nationality', sectionId: 'adm-personal', isInvalid: () => !form.nationality.trim() },
    ];
  }
  if (step === 1) {
    return [
      { id: 'classAssigned', label: 'Class applying for', sectionId: 'adm-school', isInvalid: () => !form.classAssigned.trim() },
      { id: 'dateOfAdmission', label: 'Preferred admission date', sectionId: 'adm-school', isInvalid: () => !form.dateOfAdmission.trim() },
    ];
  }
  if (step === 2) {
    return [
      { id: 'guardianName', label: 'Guardian name', sectionId: 'adm-guardian', isInvalid: () => !form.guardianName.trim() },
      { id: 'guardianContact', label: 'Guardian phone', sectionId: 'adm-guardian', isInvalid: () => !form.guardianContact.trim() },
      { id: 'homeAddress', label: 'Home address', sectionId: 'adm-guardian', isInvalid: () => !form.homeAddress.trim() },
    ];
  }
  return [];
}

/* Success screen — shared with careers */
function SuccessScreen() {
  return (
    <ApplicationSuccessScreen
      title="Application Submitted!"
      message="Thank you for applying. Our admissions office will review your application and contact you shortly."
    />
  );
}

export default function AdmissionsPage() {
  const { slug, data, accent } = useSchoolWebsite();
  const admission = data?.admission || {};
  const contact = data?.contact || {};

  const classOptions = useMemo(() => {
    const fromSystem = data?.classes?.filter((c) => c.name?.trim()) ?? [];
    if (fromSystem.length > 0) return fromSystem;
    return ((admission.programs as string[]) || [])
      .filter(Boolean)
      .map((name, index) => ({ id: index, name: String(name), level: null }));
  }, [data?.classes, admission.programs]);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationSummary, setValidationSummary] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  const setField = (field: keyof typeof INITIAL, value: string | number | Doc[]) => {
    clearFieldError(fieldErrors, field, setFieldErrors);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const computedAge = useMemo(() => {
    if (!form.dateOfBirth) return null;
    const birth = new Date(`${form.dateOfBirth}T12:00:00`);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const md = today.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age >= 0 && age < 120 ? age : null;
  }, [form.dateOfBirth]);

  const validateStep = (s: number) => {
    const result = validateFormFields(stepRules(form, s));
    if (result.ok) {
      setFieldErrors({});
      setValidationSummary('');
      return true;
    }
    setFieldErrors(result.errors);
    setValidationSummary(result.summary);
    scrollToFormField(result.firstFieldId, result.firstSectionId);
    return false;
  };

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const uploadDoc = async (file: File, label?: string) => {
    const res = await schoolWebsitePublicService.uploadDocument(slug, file);
    setForm((prev) => ({
      ...prev,
      documents: [
        ...prev.documents,
        {
          name: res.name,
          url: res.url,
          type: res.type || file.type,
          label: label || res.name,
        },
      ],
    }));
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
    await uploadDoc(file, 'Passport photo');
    e.target.value = '';
  };

  const handleDocFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      if (f.size <= 5 * 1024 * 1024) void uploadDoc(f);
    });
  };

  const submit = async () => {
    for (let s = 0; s <= 2; s += 1) {
      if (!validateStep(s)) {
        setStep(s);
        return;
      }
    }
    setSubmitting(true);
    setSubmitError('');
    const selectedClass = classOptions.find((c) => c.name === form.classAssigned);
    try {
      await schoolWebsitePublicService.submitApplication(slug, {
        first_name: form.firstName,
        last_name: form.lastName,
        applicant_name: `${form.firstName} ${form.lastName}`.trim(),
        dob: form.dateOfBirth,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        nationality: form.nationality,
        program_applied: form.classAssigned,
        classAssigned: form.classAssigned,
        class_assigned_id: selectedClass?.id || null,
        previousSchool: form.previousSchool,
        dateOfAdmission: form.dateOfAdmission,
        parent_name: form.guardianName,
        guardianName: form.guardianName,
        parent_phone: form.guardianContact,
        guardianContact: form.guardianContact,
        parent_email: form.guardianEmail,
        guardianEmail: form.guardianEmail,
        guardian2Name: form.guardian2Name,
        guardian2Contact: form.guardian2Contact,
        guardian2Relationship: form.guardian2Relationship,
        homeAddress: form.homeAddress,
        numberOfSiblings: form.numberOfSiblings,
        namesOfSiblings: form.namesOfSiblings,
        notes: form.notes,
        documents: form.documents,
      });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const applicationWindow = getApplicationWindowStatus(admission);
  const open = applicationWindow.open;

  if (done) return <SuccessScreen />;

  const progressPct = ((step + 1) / STEPS.length) * 100;
  const supportDocs = form.documents.filter((d) => (d.label || '').toLowerCase() !== 'passport photo');

  return (
    <>
      <PageHero
        title="Admissions"
        subtitle={
          open
            ? 'Complete the online application — it only takes a few minutes'
            : 'Online applications are not open at this time'
        }
      />

      <section className="sw-section" style={{ background: 'var(--sw-offwhite)' }}>
        <div className="sw-container max-w-3xl">
          {!open && applicationWindow.reason && (
            <Reveal>
              <ApplicationsClosedNotice
                kind="admissions"
                reason={applicationWindow.reason}
                openDate={applicationWindow.openDate}
                closeDate={applicationWindow.closeDate}
                contact={contact}
              />
            </Reveal>
          )}

          {admission.requirements && (
            <Reveal>
              <div className={cn('sw-card p-8', !open ? 'mt-8' : 'mb-10')}>
                <h2 className="sw-serif text-2xl">Admission Requirements</h2>
                <div
                  className="sw-prose mt-4 text-sm"
                  dangerouslySetInnerHTML={{ __html: String(admission.requirements) }}
                />
              </div>
            </Reveal>
          )}

          {open && (
            <>
          {/* Progress */}
          <Reveal>
            <div className="mb-10">
              <div className="sw-progress-track">
                <div className="sw-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="mt-4 flex justify-between">
                {STEPS.map((label, i) => (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <span className={cn('sw-step-dot', i < step && 'done', i === step && 'active')} />
                    <span
                      className="hidden text-xs font-medium sm:block"
                      style={{ color: i === step ? 'var(--sw-text)' : 'var(--sw-muted)' }}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Step card */}
          <Reveal delay={80}>
            <div className="sw-card overflow-visible p-6 md:p-10">
              <div className="mb-8">
                <p className="sw-eyebrow">Step {step + 1} of {STEPS.length}</p>
                <h2 className="sw-serif mt-2 text-3xl">{STEPS[step]}</h2>
              </div>

              <FormValidationSummary message={validationSummary} />

              {/* ---- STEP 1: PERSONAL ---- */}
              {step === 0 && (
                <div id="adm-personal" className="space-y-7">
                  <div className="rounded-xl p-6" style={{ background: 'var(--sw-gold-tint)' }}>
                    <Label>Passport photo</Label>
                    <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
                      <div className="relative">
                        <div
                          className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-white"
                          style={{ borderColor: 'var(--sw-border)' }}
                        >
                          {photoPreview ? (
                            <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Camera className="h-10 w-10" style={{ color: 'var(--sw-border)' }} />
                          )}
                        </div>
                        {photoPreview && (
                          <button
                            type="button"
                            onClick={() => setPhotoPreview(null)}
                            className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full text-white"
                            style={{ background: 'var(--sw-primary)' }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => void handlePhotoChange(e)}
                        className={`${SW_FIELD} cursor-pointer`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First name *</Label>
                      <Input id="firstName" value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} className={cn(SW_FIELD, fieldInvalidClass(!!fieldErrors.firstName))} />
                      <FormFieldError message={fieldErrors.firstName} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last name *</Label>
                      <Input id="lastName" value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} className={cn(SW_FIELD, fieldInvalidClass(!!fieldErrors.lastName))} />
                      <FormFieldError message={fieldErrors.lastName} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender *</Label>
                      <Select value={form.gender} onValueChange={(v) => setField('gender', v)}>
                        <SelectTrigger id="gender" className={cn(SW_FIELD, fieldInvalidClass(!!fieldErrors.gender))}>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent className="sw-select-content max-h-72 rounded-lg border shadow-lg">
                          <SelectItem value="Male" className="sw-select-item">Male</SelectItem>
                          <SelectItem value="Female" className="sw-select-item">Female</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormFieldError message={fieldErrors.gender} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth">Date of birth *</Label>
                      <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={(e) => setField('dateOfBirth', e.target.value)} className={cn(SW_FIELD, fieldInvalidClass(!!fieldErrors.dateOfBirth))} />
                      <FormFieldError message={fieldErrors.dateOfBirth} />
                      {computedAge !== null && (
                        <p className="text-sm" style={{ color: 'var(--sw-muted)' }}>
                          Age: <strong style={{ color: 'var(--sw-text)' }}>{computedAge}</strong> years
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nationality">Nationality *</Label>
                      <Input id="nationality" value={form.nationality} onChange={(e) => setField('nationality', e.target.value)} className={cn(SW_FIELD, fieldInvalidClass(!!fieldErrors.nationality))} />
                      <FormFieldError message={fieldErrors.nationality} />
                    </div>
                  </div>
                </div>
              )}

              {/* ---- STEP 2: SCHOOL ---- */}
              {step === 1 && (
                <div id="adm-school" className="space-y-7">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="classAssigned">Class applying for *</Label>
                      {classOptions.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--sw-gold)' }}>
                          No classes are configured yet — please contact the school office.
                        </p>
                      ) : (
                        <Select value={form.classAssigned} onValueChange={(v) => setField('classAssigned', v)}>
                          <SelectTrigger id="classAssigned" className={cn(SW_FIELD, fieldInvalidClass(!!fieldErrors.classAssigned))}>
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                          <SelectContent className="sw-select-content max-h-72 rounded-lg border shadow-lg">
                            {classOptions.map((cls) => (
                              <SelectItem key={`${cls.id}-${cls.name}`} value={cls.name} className="sw-select-item">
                                {cls.name}
                                {cls.level ? ` (${cls.level})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <FormFieldError message={fieldErrors.classAssigned} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateOfAdmission">Preferred admission date *</Label>
                      <Input id="dateOfAdmission" type="date" value={form.dateOfAdmission} onChange={(e) => setField('dateOfAdmission', e.target.value)} className={cn(SW_FIELD, fieldInvalidClass(!!fieldErrors.dateOfAdmission))} />
                      <FormFieldError message={fieldErrors.dateOfAdmission} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="previousSchool">Previous school</Label>
                    <Input id="previousSchool" value={form.previousSchool} onChange={(e) => setField('previousSchool', e.target.value)} placeholder="Previous institution (if any)" className={SW_FIELD} />
                  </div>
                </div>
              )}

              {/* ---- STEP 3: GUARDIAN ---- */}
              {step === 2 && (
                <div id="adm-guardian" className="space-y-7">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="guardianName">Guardian name *</Label>
                      <Input id="guardianName" value={form.guardianName} onChange={(e) => setField('guardianName', e.target.value)} className={cn(SW_FIELD, fieldInvalidClass(!!fieldErrors.guardianName))} />
                      <FormFieldError message={fieldErrors.guardianName} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guardianContact">Phone *</Label>
                      <Input id="guardianContact" value={form.guardianContact} onChange={(e) => setField('guardianContact', e.target.value)} placeholder="Phone number" className={cn(SW_FIELD, fieldInvalidClass(!!fieldErrors.guardianContact))} />
                      <FormFieldError message={fieldErrors.guardianContact} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guardianEmail">Email (optional)</Label>
                    <Input id="guardianEmail" type="email" value={form.guardianEmail} onChange={(e) => setField('guardianEmail', e.target.value)} className={cn(SW_FIELD, fieldInvalidClass(!!fieldErrors.guardianEmail))} />
                    <FormFieldError message={fieldErrors.guardianEmail} />
                  </div>

                  <div className="border-t pt-6" style={{ borderColor: 'var(--sw-border)' }}>
                    <p className="mb-5 text-sm font-semibold" style={{ color: 'var(--sw-muted)' }}>
                      Second guardian (optional)
                    </p>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="guardian2Name">Name</Label>
                        <Input id="guardian2Name" value={form.guardian2Name} onChange={(e) => setField('guardian2Name', e.target.value)} className={SW_FIELD} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guardian2Contact">Contact</Label>
                        <Input id="guardian2Contact" value={form.guardian2Contact} onChange={(e) => setField('guardian2Contact', e.target.value)} className={SW_FIELD} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guardian2Relationship">Relationship</Label>
                        <Input id="guardian2Relationship" value={form.guardian2Relationship} onChange={(e) => setField('guardian2Relationship', e.target.value)} placeholder="e.g. Mother" className={SW_FIELD} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="homeAddress">Home address *</Label>
                    <Textarea id="homeAddress" rows={3} value={form.homeAddress} onChange={(e) => setField('homeAddress', e.target.value)} placeholder="Street, area, city…" className={cn('sw-field min-h-[92px] w-full', fieldInvalidClass(!!fieldErrors.homeAddress))} />
                    <FormFieldError message={fieldErrors.homeAddress} />
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="numberOfSiblings">Number of siblings</Label>
                      <Input id="numberOfSiblings" type="number" min={0} value={form.numberOfSiblings} onChange={(e) => setField('numberOfSiblings', parseInt(e.target.value, 10) || 0)} className={SW_FIELD} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="namesOfSiblings">Names of siblings</Label>
                      <Input id="namesOfSiblings" value={form.namesOfSiblings} onChange={(e) => setField('namesOfSiblings', e.target.value)} placeholder="Optional" className={SW_FIELD} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Medical info, special needs, or other context…" className="sw-field min-h-[92px] w-full" />
                  </div>
                </div>
              )}

              {/* ---- STEP 4: DOCUMENTS ---- */}
              {step === 3 && (
                <div className="space-y-6">
                  <p className="text-sm" style={{ color: 'var(--sw-muted)' }}>
                    Upload the birth certificate, previous school records, and any other supporting documents.
                  </p>
                  <div
                    className={cn('sw-dropzone flex flex-col items-center justify-center p-12 text-center', dragOver && 'is-dragover')}
                    onClick={() => docInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleDocFiles(e.dataTransfer.files);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <UploadCloud className="h-10 w-10" style={{ color: 'var(--sw-primary)' }} />
                    <p className="mt-3 font-semibold" style={{ color: 'var(--sw-text)' }}>
                      Drag & drop files here, or click to browse
                    </p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--sw-muted)' }}>
                      JPG · PNG · WebP · PDF — max 5MB each
                    </p>
                    <input
                      ref={docInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => {
                        handleDocFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </div>

                  {supportDocs.length > 0 && (
                    <ul className="space-y-2.5">
                      {supportDocs.map((d) => (
                        <li
                          key={d.url}
                          className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 text-sm"
                          style={{ borderColor: 'var(--sw-border)' }}
                        >
                          <span className="flex min-w-0 items-center gap-2.5 font-medium">
                            <FileText className="h-4 w-4 shrink-0" style={{ color: accent }} />
                            <span className="truncate">{d.label || d.name}</span>
                          </span>
                          <span className="text-xs uppercase" style={{ color: 'var(--sw-muted)' }}>
                            {d.type.includes('pdf') ? 'PDF' : 'Image'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* ---- STEP 5: REVIEW ---- */}
              {step === 4 && (
                <div>
                  <dl>
                    {[
                      ['Full name', `${form.firstName} ${form.lastName}`.trim() || '—'],
                      ['Gender', form.gender || '—'],
                      ['Date of birth', form.dateOfBirth || '—'],
                      ['Nationality', form.nationality || '—'],
                      ['Class applying for', form.classAssigned || '—'],
                      ['Preferred admission date', form.dateOfAdmission || '—'],
                      ['Previous school', form.previousSchool || '—'],
                      ['Guardian', form.guardianName || '—'],
                      ['Guardian phone', form.guardianContact || '—'],
                      ['Guardian email', form.guardianEmail || '—'],
                      ['Home address', form.homeAddress || '—'],
                      ['Siblings', String(form.numberOfSiblings || 0)],
                      ['Documents', `${form.documents.length} file(s)`],
                    ].map(([k, v]) => (
                      <div key={k} className="sw-review-row">
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {submitError && (
                    <p className="mt-4 text-sm font-medium text-red-600">{submitError}</p>
                  )}
                </div>
              )}

              {/* ---- NAV BUTTONS ---- */}
              <div className="mt-10 flex justify-between border-t pt-7" style={{ borderColor: 'var(--sw-border)' }}>
                <button type="button" className="sw-btn sw-btn-outline" onClick={back} disabled={step === 0}>
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                {step < STEPS.length - 1 ? (
                  <button type="button" className="sw-btn sw-btn-primary" onClick={next} disabled={!open}>
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button type="button" className="sw-btn sw-btn-primary" onClick={() => void submit()} disabled={!open || submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Application'}
                  </button>
                )}
              </div>
            </div>
          </Reveal>
            </>
          )}
        </div>
      </section>
    </>
  );
}
