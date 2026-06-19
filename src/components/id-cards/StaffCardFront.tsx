import React from 'react';
import type { IDCardColors, IDCardData } from '@/types/idCard';
import InlineEditField, { LockedField } from './InlineEditField';
import {
  CardPhoto,
  CardShell,
  CardWaveSVG,
  SchoolLogo,
  fieldLabelStyle,
  cardText,
  GRAY_LABEL,
} from './cardShared';
import { StudentCardBack } from './StudentCardFront';

type CardFaceProps = {
  data: IDCardData;
  colors: IDCardColors;
  editMode?: boolean;
  previewMode?: boolean;
  onChange?: (patch: Partial<IDCardData>) => void;
  printMode?: boolean;
};

const StaffCardFront: React.FC<CardFaceProps> = ({
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
            <span style={fieldLabelStyle(printMode)}>STAFF ID</span>
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
            <span style={fieldLabelStyle(printMode)}>POSITION</span>
            {canEdit && onChange ? (
              <InlineEditField
                editMode
                value={(data.position || '').toUpperCase()}
                onChange={(v) => onChange({ position: v.toUpperCase() })}
                primaryColor={primaryColor}
                style={cardText(
                  {
                    fontSize: 15,
                    fontWeight: 700,
                    color: primaryColor,
                    textTransform: 'uppercase',
                    display: 'block',
                  },
                  printMode
                )}
              />
            ) : (
              <span
                style={cardText(
                  {
                    fontSize: 15,
                    fontWeight: 700,
                    color: primaryColor,
                    textTransform: 'uppercase',
                    display: 'block',
                  },
                  printMode
                )}
              >
                {(data.position || '—').toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <span style={fieldLabelStyle(printMode)}>DEPARTMENT</span>
            {canEdit && onChange ? (
              <InlineEditField
                editMode
                value={(data.department || '').toUpperCase()}
                onChange={(v) => onChange({ department: v.toUpperCase() })}
                primaryColor={primaryColor}
                style={cardText(
                  {
                    fontSize: 15,
                    fontWeight: 700,
                    color: primaryColor,
                    textTransform: 'uppercase',
                    display: 'block',
                  },
                  printMode
                )}
              />
            ) : (
              <span
                style={cardText(
                  {
                    fontSize: 15,
                    fontWeight: 700,
                    color: primaryColor,
                    textTransform: 'uppercase',
                    display: 'block',
                  },
                  printMode
                )}
              >
                {(data.department || '—').toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  );
};

export function StaffCardBack(props: CardFaceProps) {
  return <StudentCardBack {...props} />;
}

export default StaffCardFront;
