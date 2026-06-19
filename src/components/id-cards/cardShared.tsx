import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import type { IDCardColors } from '@/types/idCard';
import { CARD_WIDTH_PX, CARD_HEIGHT_PX } from '@/types/idCard';

export const CARD_FONT = 'Inter, system-ui, sans-serif';

const PRINT_TEXT: React.CSSProperties = {
  fontFamily: CARD_FONT,
  letterSpacing: 'normal',
  wordSpacing: 'normal',
  WebkitFontSmoothing: 'antialiased',
};

/** Merge print-safe typography when capturing or printing. */
export function cardText(style: React.CSSProperties, printMode?: boolean): React.CSSProperties {
  return printMode ? { ...PRINT_TEXT, ...style } : style;
}

export const GRAY_LABEL = '#6b7280';
export const GRAY_LABEL_LIGHT = '#9ca3af';
export const GRAY_BODY = '#4b5563';
export const DIVIDER = '#e5e7eb';
export const FOOTER_TEXT = '#ffffff';
export const PHOTO_PLACEHOLDER = '#e5e7eb';

export function CardShell({
  id,
  children,
  printMode = false,
}: {
  id?: string;
  children: React.ReactNode;
  printMode?: boolean;
}) {
  return (
    <div
      id={id}
      style={{
        width: CARD_WIDTH_PX,
        height: CARD_HEIGHT_PX,
        borderRadius: printMode ? 0 : 14,
        background: '#ffffff',
        overflow: printMode ? 'visible' : 'hidden',
        position: 'relative',
        fontFamily: CARD_FONT,
        boxSizing: 'border-box',
        boxShadow: printMode ? 'none' : undefined,
        transform: printMode ? 'none' : undefined,
        transition: printMode ? 'none' : undefined,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        ...(printMode ? PRINT_TEXT : {}),
      }}
    >
      {children}
    </div>
  );
}

export function CardWaveSVG({
  primaryColor,
  accentColor,
}: {
  primaryColor?: string;
  accentColor?: string;
}) {
  const primary = (primaryColor?.trim() || '#1a3a6b');
  const accent = (accentColor?.trim() || '#c9a227');

  return (
    <svg
      viewBox="0 0 560 80"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: 80,
        zIndex: 1,
        pointerEvents: 'none',
        color: 'unset',
      }}
      aria-hidden
    >
      <path
        d="M0,60 C80,20 200,70 320,40 C400,20 480,55 560,35 L560,80 L0,80 Z"
        fill={primary}
      />
      <path
        d="M0,62 C80,22 200,72 320,42 C400,22 480,57 560,37"
        fill="none"
        stroke={accent}
        strokeWidth={2.5}
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path
        d="M6.6 2h2.2c.6 0 1.1.4 1.2 1l.4 2.4c.1.5-.2 1-.7 1.2l-1.5.7c1 2.1 2.6 3.7 4.7 4.7l.7-1.5c.2-.5.7-.8 1.2-.7l2.4.4c.6.1 1 .6 1 1.2v2.2c0 .7-.5 1.2-1.1 1.3C10.1 20.5 3.5 13.9 4.3 7.7 4.4 7.1 4.9 6.6 5.6 6.6Z"
        fill="#ffffff"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" stroke="#ffffff" strokeWidth="1.8" />
      <path d="M3 12h18M12 3c2.5 2.8 2.5 14.2 0 18M12 3c-2.5 2.8-2.5 14.2 0 18" stroke="#ffffff" strokeWidth="1.5" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path
        d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"
        stroke="#ffffff"
        strokeWidth="1.8"
      />
      <path d="m4 7 8 6 8-6" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CardFooterBar({
  colors,
  phone,
  website,
  email,
  editMode,
  onPhoneChange,
  onWebsiteChange,
  onEmailChange,
  primaryColor,
}: {
  colors: IDCardColors;
  phone: string;
  website: string;
  email: string;
  editMode?: boolean;
  onPhoneChange?: (v: string) => void;
  onWebsiteChange?: (v: string) => void;
  onEmailChange?: (v: string) => void;
  primaryColor: string;
}) {
  const websiteTrimmed = String(website || '').trim();
  const emailTrimmed = String(email || '').trim();
  const showWebsite = websiteTrimmed.length > 0;
  const showEmail = !showWebsite && emailTrimmed.length > 0;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        minHeight: 36,
        background: colors.footerBg,
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        padding: '6px 12px',
        boxSizing: 'border-box',
        borderBottomLeftRadius: 14,
        borderBottomRightRadius: 14,
        zIndex: 4,
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: FOOTER_TEXT,
            fontSize: 8,
            lineHeight: 1.2,
            flexShrink: 0,
          }}
        >
          <PhoneIcon />
          {editMode && onPhoneChange ? (
            <FooterEdit value={phone} onChange={onPhoneChange} primaryColor={primaryColor} />
          ) : (
            <span style={{ fontSize: 8, color: FOOTER_TEXT, whiteSpace: 'nowrap' }}>{phone || '—'}</span>
          )}
        </span>
        {showWebsite && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: FOOTER_TEXT,
              fontSize: 8,
              lineHeight: 1.2,
              minWidth: 0,
              flex: 1,
            }}
          >
            <GlobeIcon />
            {editMode && onWebsiteChange ? (
              <FooterEdit value={website} onChange={onWebsiteChange} primaryColor={primaryColor} maxWidth={200} />
            ) : (
              <span
                style={{
                  fontSize: 8,
                  color: FOOTER_TEXT,
                  wordBreak: 'break-all',
                  whiteSpace: 'normal',
                  lineHeight: 1.2,
                }}
              >
                {websiteTrimmed}
              </span>
            )}
          </span>
        )}
        {showEmail && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: FOOTER_TEXT,
              fontSize: 8,
              lineHeight: 1.2,
              minWidth: 0,
              flex: 1,
            }}
          >
            <MailIcon />
            {editMode && onEmailChange ? (
              <FooterEdit value={email} onChange={onEmailChange} primaryColor={primaryColor} maxWidth={200} />
            ) : (
              <span
                style={{
                  fontSize: 8,
                  color: FOOTER_TEXT,
                  wordBreak: 'break-all',
                  whiteSpace: 'normal',
                  lineHeight: 1.2,
                }}
              >
                {emailTrimmed}
              </span>
            )}
          </span>
        )}
      </div>
      <span
        style={{
          color: colors.poweredByColor,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 8,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          textAlign: 'right',
        }}
      >
        Powered by ScholarNerve
      </span>
    </div>
  );
}

function FooterEdit({
  value,
  onChange,
  primaryColor,
  maxWidth,
}: {
  value: string;
  onChange: (v: string) => void;
  primaryColor: string;
  maxWidth?: number;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'transparent',
        border: 'none',
        borderBottom: `1px solid ${primaryColor}`,
        borderRadius: 0,
        fontSize: 8,
        fontStyle: 'normal',
        color: FOOTER_TEXT,
        width: maxWidth || 90,
        outline: 'none',
        padding: 0,
        margin: 0,
      }}
    />
  );
}

export function SchoolLogo({ logoUrl, schoolName }: { logoUrl: string | null; schoolName: string }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{ width: 52, height: 52, objectFit: 'contain', flexShrink: 0, display: 'block' }}
      />
    );
  }
  return (
    <div
      style={{
        width: 52,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        color: GRAY_LABEL,
        flexShrink: 0,
      }}
    >
      {schoolName.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function CardPhoto({ data, primaryColor }: { data: { photoBase64: string | null; photoUrl: string | null }; primaryColor: string }) {
  const src = data.photoBase64 || data.photoUrl || '';
  return (
    <div
      style={{
        width: 155,
        height: 185,
        borderRadius: 8,
        border: `2.5px solid ${primaryColor}`,
        overflow: 'hidden',
        background: PHOTO_PLACEHOLDER,
        position: 'relative',
        zIndex: 2,
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
            display: 'block',
          }}
        />
      ) : null}
    </div>
  );
}

export function CardQrBlock({ url }: { url: string }) {
  return (
    <div
      style={{
        width: 110,
        height: 110,
        border: '2px solid #e5e7eb',
        borderRadius: 6,
        padding: 6,
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <QRCodeCanvas value={url || ' '} size={94} />
    </div>
  );
}

export const fieldLabelStyle = (printMode?: boolean): React.CSSProperties =>
  cardText(
    {
      fontSize: 9,
      fontWeight: 400,
      color: GRAY_LABEL_LIGHT,
      textTransform: 'uppercase',
      letterSpacing: '1.5px',
      marginBottom: 2,
      display: 'block',
    },
    printMode
  );
