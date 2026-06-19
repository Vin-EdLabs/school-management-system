import React from 'react';
import type { IDCardColors, IDCardData } from '@/types/idCard';
import InlineEditField, { LockedField } from './InlineEditField';
import {
  CardFooterBar,
  CardPhoto,
  CardQrBlock,
  CardShell,
  CardWaveSVG,
  SchoolLogo,
  fieldLabelStyle,
  cardText,
  GRAY_LABEL,
} from './cardShared';

type CardFaceProps = {
  data: IDCardData;
  colors: IDCardColors;
  editMode?: boolean;
  previewMode?: boolean;
  onChange?: (patch: Partial<IDCardData>) => void;
  printMode?: boolean;
};

const StudentCardFront: React.FC<CardFaceProps> = ({
  data,
  colors,
  editMode = false,
  previewMode = false,
  onChange,
  printMode = false,
}) => {
  const primaryColor = colors.primaryColor ?? '#1a3a6b';
  const accentColor = colors.accentColor ?? '#c9a227';
  const canEdit = editMode && !previewMode;

  return (
    <CardShell id={printMode ? undefined : 'card-front-render'} printMode={printMode}>
      <CardWaveSVG primaryColor={primaryColor} accentColor={accentColor} />

      {/* Header */}
      <div
        style={{
          height: 70,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'relative',
          zIndex: 3,
          boxSizing: 'border-box',
        }}
      >
        <SchoolLogo logoUrl={data.logoUrl} schoolName={data.schoolName} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={cardText(
              {
                fontSize: 22,
                fontWeight: 700,
                color: primaryColor,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                lineHeight: 1.15,
              },
              printMode
            )}
          >
            {data.schoolName}
          </div>
          <div
            style={cardText(
              {
                fontSize: 10,
                fontWeight: 400,
                color: GRAY_LABEL,
                letterSpacing: '1.5px',
                textAlign: 'left',
                marginTop: 2,
              },
              printMode
            )}
          >
            {canEdit && onChange ? (
              <InlineEditField
                editMode
                value={data.motto}
                onChange={(v) => onChange({ motto: v })}
                primaryColor={primaryColor}
                style={{ fontSize: 10, fontWeight: 400, color: GRAY_LABEL, letterSpacing: '1.5px', display: 'block' }}
              />
            ) : (
              data.motto
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: `1.5px solid ${primaryColor}`,
          margin: '0 16px',
          opacity: 0.3,
          position: 'relative',
          zIndex: 3,
        }}
      />

      <div
        style={cardText(
          {
            padding: '4px 16px',
            fontSize: 10,
            color: GRAY_LABEL,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            textAlign: 'center',
            position: 'relative',
            zIndex: 3,
          },
          printMode
        )}
      >
        SCHOOL CODE:{' '}
        <span style={{ fontWeight: 700, color: GRAY_LABEL }}>{data.schoolCode}</span>
      </div>

      {/* Body */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          padding: '8px 16px 36px 16px',
          position: 'relative',
          zIndex: 3,
          boxSizing: 'border-box',
          minHeight: 220,
        }}
      >
        <div style={{ width: '42%', flexShrink: 0 }}>
          <CardPhoto data={data} primaryColor={primaryColor} />
        </div>
        <div
          style={{
            width: '58%',
            paddingLeft: 16,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <LockedField style={{ display: 'block', marginBottom: 10 }} previewMode={previewMode}>
            <span
              style={cardText(
                {
                  fontSize: 18,
                  fontWeight: 700,
                  color: primaryColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  display: 'block',
                },
                printMode
              )}
            >
              {data.fullName}
            </span>
          </LockedField>

          <div>
            <span style={fieldLabelStyle(printMode)}>STUDENT ID</span>
            <LockedField previewMode={previewMode}>
              <span
                style={cardText(
                  {
                    fontSize: 16,
                    fontWeight: 700,
                    color: primaryColor,
                    letterSpacing: '0.5px',
                    display: 'block',
                  },
                  printMode
                )}
              >
                {data.idNumber}
              </span>
            </LockedField>
          </div>

          <div>
            <span style={fieldLabelStyle(printMode)}>ACADEMIC YEAR</span>
            {canEdit && onChange ? (
              <InlineEditField
                editMode
                value={data.academicYear || ''}
                onChange={(v) => onChange({ academicYear: v })}
                primaryColor={primaryColor}
                style={cardText({ fontSize: 15, fontWeight: 700, color: primaryColor, display: 'block' }, printMode)}
              />
            ) : (
              <span style={cardText({ fontSize: 15, fontWeight: 700, color: primaryColor, display: 'block' }, printMode)}>
                {data.academicYear || '—'}
              </span>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  );
};

export function StudentCardBack({
  data,
  colors,
  editMode = false,
  previewMode = false,
  onChange,
  printMode = false,
}: CardFaceProps) {
  const primaryColor = colors.primaryColor ?? '#1a3a6b';
  const canEdit = editMode && !previewMode;

  return (
    <CardShell id={printMode ? undefined : 'card-back-render'} printMode={printMode}>
      <div
        style={{
          width: '100%',
          height: 38,
          background: primaryColor,
          borderRadius: '14px 14px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={cardText(
            {
              fontSize: 11,
              fontWeight: 400,
              color: '#ffffff',
              textAlign: 'center',
              padding: '0 16px',
              whiteSpace: 'normal',
            },
            printMode
          )}
        >
          {canEdit && onChange ? (
            <InlineEditField
              editMode
              value={data.propertyHeader}
              onChange={(v) => onChange({ propertyHeader: v })}
              primaryColor={primaryColor}
              style={{ fontSize: 11, fontWeight: 400, color: '#ffffff', textAlign: 'center', display: 'block' }}
            />
          ) : (
            data.propertyHeader
          )}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          height: 270,
          padding: 16,
          boxSizing: 'border-box',
          paddingBottom: 52,
        }}
      >
        <div style={{ width: '52%', paddingRight: 16, borderRight: '1px solid #e5e7eb', boxSizing: 'border-box' }}>
          <div
            style={cardText(
              {
                fontSize: 11,
                fontWeight: 700,
                color: primaryColor,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: 10,
              },
              printMode
            )}
          >
            INSTRUCTIONS
          </div>
          <ul style={{ margin: 0, paddingLeft: 14, listStyle: 'disc' }}>
            {data.instructions.map((line, i) => (
              <li
                key={i}
                style={cardText(
                  {
                    fontSize: 10,
                    fontWeight: 400,
                    color: '#4b5563',
                    lineHeight: 1.5,
                    marginBottom: 6,
                    whiteSpace: 'normal',
                  },
                  printMode
                )}
              >
                {canEdit && onChange ? (
                  <InlineEditField
                    editMode
                    value={line}
                    onChange={(v) => {
                      const next = [...data.instructions];
                      next[i] = v;
                      onChange({ instructions: next });
                    }}
                    primaryColor={primaryColor}
                    style={{ fontSize: 10, fontWeight: 400, color: '#4b5563', display: 'inline' }}
                  />
                ) : (
                  line
                )}
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            width: '48%',
            paddingLeft: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxSizing: 'border-box',
          }}
        >
          <CardQrBlock url={data.qrUrl} />
          <span
            style={cardText(
              {
                fontSize: 10,
                fontStyle: 'italic',
                color: primaryColor,
                textAlign: 'center',
                marginTop: 4,
              },
              printMode
            )}
          >
            {canEdit && onChange ? (
              <InlineEditField
                editMode
                value={data.scanLabel}
                onChange={(v) => onChange({ scanLabel: v })}
                primaryColor={primaryColor}
                style={{ fontSize: 10, fontStyle: 'italic', color: primaryColor, textAlign: 'center', display: 'block' }}
              />
            ) : (
              data.scanLabel
            )}
          </span>
        </div>
      </div>

      <CardFooterBar
        colors={colors}
        phone={data.phone}
        website={data.website}
        email={data.email || ''}
        editMode={canEdit}
        primaryColor={primaryColor}
        onPhoneChange={onChange ? (v) => onChange({ phone: v }) : undefined}
        onWebsiteChange={onChange ? (v) => onChange({ website: v }) : undefined}
        onEmailChange={onChange ? (v) => onChange({ email: v }) : undefined}
      />
    </CardShell>
  );
}

export default StudentCardFront;
