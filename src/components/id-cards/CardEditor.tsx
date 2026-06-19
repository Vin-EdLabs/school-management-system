import React, { useEffect, useState } from 'react';
import type { CardEntityType, IDCardColors, IDCardData } from '@/types/idCard';
import StudentCardFront, { StudentCardBack } from './StudentCardFront';
import StaffCardFront, { StaffCardBack } from './StaffCardFront';
import { ScaledCardPreview } from './ScaledCardPreview';
import { resolveIdCardVerifyUrl } from '@/utils/idCardVerifyUrl';

export type EditableFieldKey =
  | 'motto'
  | 'academicYear'
  | 'position'
  | 'department'
  | 'propertyHeader'
  | 'scanLabel';

type CardEditorProps = {
  entityType: CardEntityType;
  entityId?: number;
  data: IDCardData;
  colors: IDCardColors;
  editMode?: boolean;
  onChange: (data: IDCardData) => void;
  scale?: number;
  showVerifyUrl?: boolean;
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '2px',
  color: '#9ca3af',
  marginBottom: 8,
  textAlign: 'center',
};

const CardEditor: React.FC<CardEditorProps> = ({
  entityType,
  entityId,
  data,
  colors,
  editMode = false,
  onChange,
  scale = 0.9,
  showVerifyUrl = false,
}) => {
  const handleChange = (patch: Partial<IDCardData>) => onChange({ ...data, ...patch });
  const Front = entityType === 'STUDENT' ? StudentCardFront : StaffCardFront;
  const Back = entityType === 'STUDENT' ? StudentCardBack : StaffCardBack;

  const [effectiveScale, setEffectiveScale] = useState(scale);
  useEffect(() => {
    const update = () => setEffectiveScale(window.innerWidth < 1200 ? 0.75 : scale);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [scale]);

  const verifyUrl =
    entityId != null && data.qrUrl
      ? data.qrUrl
      : entityId != null
        ? resolveIdCardVerifyUrl(entityType, entityId)
        : data.qrUrl;

  return (
    <div style={{ background: '#f8f9fa', borderRadius: 16, padding: '24px 16px', overflow: 'visible' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={labelStyle}>FRONT</div>
        <ScaledCardPreview scale={effectiveScale}>
          <Front data={{ ...data, qrUrl: verifyUrl }} colors={colors} editMode={editMode} onChange={handleChange} />
        </ScaledCardPreview>
      </div>
      <div>
        <div style={labelStyle}>BACK</div>
        <ScaledCardPreview scale={effectiveScale}>
          <Back data={{ ...data, qrUrl: verifyUrl }} colors={colors} editMode={editMode} onChange={handleChange} />
        </ScaledCardPreview>
      </div>
      {showVerifyUrl && verifyUrl && (
        <div
          style={{
            marginTop: 20,
            padding: '12px 14px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 10,
            fontSize: 12,
            color: '#1d4ed8',
            wordBreak: 'break-all',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 4, color: '#1e40af' }}>Scan URL (testing)</strong>
          <a href={verifyUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
            {verifyUrl}
          </a>
        </div>
      )}
    </div>
  );
};

export default CardEditor;

export const EDITABLE_FIELD_LABELS: Record<EditableFieldKey, string> = {
  motto: 'School Slogan',
  academicYear: 'Academic Year',
  position: 'Position',
  department: 'Department',
  propertyHeader: 'Back Header Text',
  scanLabel: 'QR Scan Label',
};
