import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Lock, GripVertical } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiService } from '@/services/api';
import { toast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';
import type { IDCardData } from '@/types/idCard';
import { DEFAULT_STUDENT_COLORS } from '@/types/idCard';
import StudentCardFront, { StudentCardBack } from '../id-cards/StudentCardFront';
import { ScaledCardPreview } from '../id-cards/ScaledCardPreview';
import InstructionListEditor from './InstructionListEditor';
import { normalizeHexColor, renderIdCardInstructions, renderIdCardTemplateText } from '@/utils/idCardTemplate';
import { previewIdCardVerifyUrl } from '@/utils/idCardVerifyUrl';

type TemplateForm = {
  primaryColor: string;
  accentColor: string;
  footerBg: string;
  poweredByColor: string;
  schoolSlogan: string;
  schoolCode: string;
  schoolPhone: string;
  schoolEmail: string;
  schoolWebsite: string;
  backHeaderText: string;
  instructions: string[];
};

const PREVIEW_SCALE = 0.58;

const DEFAULT_INSTRUCTIONS = [
  'This card identifies the bearer as a member of {schoolName}.',
  'It must be worn at all times within the school premises.',
  'This card is non-transferable.',
  'If found, please return to the school office.',
];

function defaultForm(): TemplateForm {
  return {
    ...DEFAULT_STUDENT_COLORS,
    schoolSlogan: 'Excellence • Discipline • Character',
    schoolCode: '',
    schoolPhone: '',
    schoolEmail: '',
    schoolWebsite: '',
    backHeaderText: 'This card is the property of {schoolName}.',
    instructions: [...DEFAULT_INSTRUCTIONS],
  };
}

function SectionHeader({ title, accentColor }: { title: string; accentColor: string }) {
  return (
    <h2
      style={{
        borderLeft: `3px solid ${accentColor}`,
        paddingLeft: 12,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        color: '#374151',
        marginBottom: 16,
      }}
    >
      {title}
    </h2>
  );
}

function ColorBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [hex, setHex] = useState(value);
  const [open, setOpen] = useState(false);
  useEffect(() => setHex(value), [value]);

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 14,
        transition: 'box-shadow 150ms ease',
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>{label}</div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            style={{
              width: '100%',
              height: 48,
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: value,
              cursor: 'pointer',
              marginBottom: 10,
              transition: 'opacity 150ms ease',
            }}
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-3" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.15)', borderRadius: 12 }}>
          <HexColorPicker color={value} onChange={(c) => { onChange(c); setHex(c); }} style={{ width: 200, height: 140 }} />
        </PopoverContent>
      </Popover>
      <input
        value={hex}
        onChange={(e) => setHex(e.target.value)}
        onBlur={() => onChange(normalizeHexColor(hex))}
        style={{
          width: '100%',
          height: 32,
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: 12,
          textTransform: 'uppercase',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '0 8px',
        }}
      />
    </div>
  );
}

function ScaledPreview({ children }: { children: React.ReactNode }) {
  return <ScaledCardPreview scale={PREVIEW_SCALE}>{children}</ScaledCardPreview>;
}

type IdCardSettingsProps = {
  onNavigate?: (module: string) => void;
};

const IdCardSettings: React.FC<IdCardSettingsProps> = ({ onNavigate }) => {
  const { schoolId, school } = useSchool();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolName, setSchoolName] = useState(school?.name || 'School');
  const [form, setForm] = useState<TemplateForm>(defaultForm());
  const [saved, setSaved] = useState<TemplateForm>(defaultForm());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const path = schoolId ? `/schools/${schoolId}/id-card-template` : '/id-cards/template';
      const res = await apiService.get<TemplateForm & { schoolName: string }>(path);
      const slugDefault = (school?.slug || 'school').toUpperCase().slice(0, 6);
      const mapped: TemplateForm = {
        primaryColor: res.primaryColor,
        accentColor: res.accentColor,
        footerBg: res.footerBg || res.primaryColor,
        poweredByColor: res.poweredByColor || '#ffffff',
        schoolSlogan: res.schoolSlogan || defaultForm().schoolSlogan,
        schoolCode: res.schoolCode?.trim() || slugDefault,
        schoolPhone: res.schoolPhone || '',
        schoolEmail: res.schoolEmail || '',
        schoolWebsite: res.schoolWebsite || '',
        backHeaderText: res.backHeaderText || defaultForm().backHeaderText,
        instructions: res.instructions?.length ? res.instructions : [...DEFAULT_INSTRUCTIONS],
      };
      setForm(mapped);
      setSaved(mapped);
      if (res.schoolName) setSchoolName(res.schoolName);
    } catch {
      toast.error('Could not load configuration');
    } finally {
      setLoading(false);
    }
  }, [schoolId, school?.slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  const accent = form.primaryColor;

  const colors = useMemo(
    () => ({
      primaryColor: form.primaryColor,
      accentColor: form.accentColor,
      footerBg: form.footerBg,
      poweredByColor: form.poweredByColor,
    }),
    [form]
  );

  const previewData: IDCardData = useMemo(() => {
    const slug = (school?.slug || 'school').toLowerCase();
    const website = form.schoolWebsite.trim();
    return {
      schoolName: schoolName.toUpperCase(),
      motto: form.schoolSlogan,
      schoolCode: form.schoolCode.trim().toUpperCase() || slug.toUpperCase().slice(0, 6),
      phone: form.schoolPhone || '0302 123 456',
      website,
      email: form.schoolEmail.trim(),
      logoUrl: school?.logo_url || null,
      photoUrl: null,
      photoBase64: null,
      qrUrl: previewIdCardVerifyUrl(slug),
      fullName: 'SAMPLE STUDENT',
      idNumber: 'SA25STU0001',
      academicYear: '2025 / 2026',
      propertyHeader: renderIdCardTemplateText(form.backHeaderText, schoolName),
      instructions: renderIdCardInstructions(form.instructions, schoolName),
      scanLabel: 'Scan to verify identity',
    };
  }, [form, schoolName, school]);

  const save = async () => {
    if (!isDirty) return;
    setSaving(true);
    try {
      const body = { ...form, instructions: form.instructions };
      const path = schoolId ? `/schools/${schoolId}/id-card-template` : '/id-cards/template';
      const res = await apiService.patch<TemplateForm & { schoolName: string }>(path, body);
      const mapped: TemplateForm = {
        primaryColor: res.primaryColor,
        accentColor: res.accentColor,
        footerBg: res.footerBg || res.primaryColor,
        poweredByColor: res.poweredByColor || '#ffffff',
        schoolSlogan: res.schoolSlogan,
        schoolCode: res.schoolCode?.trim() || form.schoolCode,
        schoolPhone: res.schoolPhone || '',
        schoolEmail: res.schoolEmail || '',
        schoolWebsite: res.schoolWebsite || '',
        backHeaderText: res.backHeaderText,
        instructions: res.instructions || form.instructions,
      };
      setForm(mapped);
      setSaved(mapped);
      toast.success('Configuration saved successfully');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 40,
    padding: '0 12px',
    fontSize: 14,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    boxSizing: 'border-box',
  };

  if (loading) {
    return <p style={{ padding: 32, color: '#6b7280', fontSize: 14 }}>Loading ID card configuration…</p>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            ID Card Configuration
            {isDirty && <span title="Unsaved changes" style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>
            Customize how your school&apos;s ID cards look and what they say
          </p>
        </div>
        <button
          type="button"
          disabled={!isDirty || saving}
          onClick={() => void save()}
          style={{
            height: 40,
            padding: '0 20px',
            borderRadius: 10,
            border: 'none',
            fontWeight: 500,
            fontSize: 14,
            cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
            background: isDirty ? accent : '#f3f4f6',
            color: isDirty ? '#fff' : '#d1d5db',
            transition: 'all 150ms ease',
            boxShadow: isDirty ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ width: 420, flexShrink: 0 }}>
          <SectionHeader title="Brand Colors" accentColor={accent} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
            <ColorBox label="Primary Color" value={form.primaryColor} onChange={(v) => setForm((f) => ({ ...f, primaryColor: v }))} />
            <ColorBox label="Accent Color" value={form.accentColor} onChange={(v) => setForm((f) => ({ ...f, accentColor: v }))} />
            <ColorBox label="Footer Color" value={form.footerBg} onChange={(v) => setForm((f) => ({ ...f, footerBg: v }))} />
            <ColorBox label="Badge Color" value={form.poweredByColor} onChange={(v) => setForm((f) => ({ ...f, poweredByColor: v }))} />
          </div>

          <SectionHeader title="School Information" accentColor={accent} />
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>School Name</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
              <span style={{ flex: 1, fontSize: 14, color: '#374151' }}>{schoolName}</span>
              <Lock size={14} color="#9ca3af" />
            </div>
            <button type="button" onClick={() => onNavigate?.('settings')} style={{ marginTop: 6, fontSize: 12, color: accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              ← Edit in School Profile
            </button>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>School Slogan</label>
            <input style={inputStyle} value={form.schoolSlogan} maxLength={60} placeholder="e.g. Excellence • Discipline • Character" onChange={(e) => setForm((f) => ({ ...f, schoolSlogan: e.target.value }))} />
            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4 }}>{form.schoolSlogan.length}/60</p>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>School Code</label>
            <input
              style={{ ...inputStyle, textAlign: 'center', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase' }}
              value={form.schoolCode}
              maxLength={20}
              placeholder="e.g. ROSA"
              onChange={(e) => setForm((f) => ({ ...f, schoolCode: e.target.value.toUpperCase() }))}
            />
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, textAlign: 'center' }}>
              Shown centered on the front of every ID card
            </p>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Contact Phone</label>
            <input style={inputStyle} type="tel" value={form.schoolPhone} placeholder="e.g. 0302 123 456" onChange={(e) => setForm((f) => ({ ...f, schoolPhone: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>School Email</label>
            <input style={inputStyle} type="email" value={form.schoolEmail} placeholder="e.g. info@yourschool.edu.gh" onChange={(e) => setForm((f) => ({ ...f, schoolEmail: e.target.value }))} />
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
              Shown on the card back when no website URL is set
            </p>
          </div>
          <div style={{ marginBottom: 32 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Website URL</label>
            <input style={inputStyle} type="url" value={form.schoolWebsite} placeholder="e.g. www.yourschool.edu.gh (optional)" onChange={(e) => setForm((f) => ({ ...f, schoolWebsite: e.target.value }))} />
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
              Leave blank to show school email instead on the card back
            </p>
          </div>

          <SectionHeader title="Back of Card" accentColor={accent} />
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Card Header Text</label>
            <input style={inputStyle} value={form.backHeaderText} onChange={(e) => setForm((f) => ({ ...f, backHeaderText: e.target.value }))} />
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Use {'{schoolName}'} as placeholder for your school name</p>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block' }}>Card Instructions</label>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 12px' }}>These appear on the back of both student and staff cards</p>
            <InstructionListEditor items={form.instructions} onChange={(instructions) => setForm((f) => ({ ...f, instructions }))} primaryColor={accent} />
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#1d4ed8' }}>
            ℹ️ These settings apply to both Student and Staff ID cards automatically
          </div>
        </div>

        <div style={{ flex: 1, position: 'sticky', top: 24 }}>
          <div style={{ background: '#f3f4f6', borderRadius: 20, padding: '32px 24px' }}>
            <p style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#9ca3af', textAlign: 'center', marginBottom: 24, fontWeight: 600 }}>
              Live Preview
            </p>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: '#9ca3af', textAlign: 'center', marginBottom: 8 }}>FRONT</p>
            <ScaledPreview>
              <StudentCardFront data={previewData} colors={colors} previewMode />
            </ScaledPreview>
            <div style={{ height: 24 }} />
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: '#9ca3af', textAlign: 'center', marginBottom: 8 }}>BACK</p>
            <ScaledPreview>
              <StudentCardBack data={previewData} colors={colors} previewMode />
            </ScaledPreview>
            <p style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 20 }}>Printed size: 85.6mm × 54mm</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdCardSettings;
