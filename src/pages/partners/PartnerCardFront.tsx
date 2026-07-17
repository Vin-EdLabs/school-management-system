import React from 'react';
import type { IDCardColors } from '@/types/idCard';
import {
  CardFooterBar,
  CardPhoto,
  CardShell,
  CardWaveSVG,
  GRAY_LABEL,
  cardText,
  fieldLabelStyle,
} from '@/components/id-cards/cardShared';
import { PARTNER_LOGO_SRC } from './PartnerLogo';
import { TIER_META, type PartnerProfile } from '@/services/partnerApi';

export const PARTNER_ID_COLORS: IDCardColors = {
  primaryColor: '#085041',
  accentColor: '#c9a227',
  footerBg: '#085041',
  poweredByColor: '#ffffff',
};

type PartnerCardFrontProps = {
  partner: PartnerProfile;
  colors?: IDCardColors;
};

export default function PartnerCardFront({ partner, colors = PARTNER_ID_COLORS }: PartnerCardFrontProps) {
  const primaryColor = colors.primaryColor ?? '#085041';
  const accentColor = colors.accentColor ?? '#c9a227';
  const fullName = `${partner.firstName} ${partner.lastName}`.trim();
  const tierLabel = TIER_META[partner.tier]?.label ?? 'Partner';

  return (
    <CardShell>
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
        <div
          style={{
            height: 56,
            width: 56,
            borderRadius: 12,
            background: '#ffffff',
            boxShadow: '0 2px 8px rgba(8,80,65,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            padding: 6,
            boxSizing: 'border-box',
          }}
        >
          <img
            src={PARTNER_LOGO_SRC}
            alt=""
            style={{
              height: 44,
              width: 44,
              objectFit: 'contain',
              imageRendering: 'auto',
            }}
          />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={cardText(
              {
                fontSize: 18,
                fontWeight: 700,
                color: primaryColor,
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                lineHeight: 1.15,
              },
              false
            )}
          >
            ScholarNerve
          </div>
          <div
            style={cardText(
              {
                fontSize: 11,
                fontWeight: 700,
                color: accentColor,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                marginTop: 2,
              },
              false
            )}
          >
            Official Partner
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
          false
        )}
      >
        PARTNER ID:{' '}
        <span style={{ fontWeight: 700, color: primaryColor }}>{partner.partnerId || 'PENDING'}</span>
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
          <CardPhoto
            data={{ photoUrl: partner.profilePhotoUrl, photoBase64: null }}
            primaryColor={primaryColor}
          />
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
          <span
            style={cardText(
              {
                fontSize: 17,
                fontWeight: 700,
                color: primaryColor,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                display: 'block',
                lineHeight: 1.2,
              },
              false
            )}
          >
            {fullName}
          </span>

          <div>
            <span style={fieldLabelStyle(false)}>TIER</span>
            <span
              style={cardText(
                { fontSize: 15, fontWeight: 700, color: accentColor, display: 'block' },
                false
              )}
            >
              {tierLabel}
            </span>
          </div>

          <div>
            <span style={fieldLabelStyle(false)}>REGION</span>
            <span
              style={cardText(
                { fontSize: 14, fontWeight: 700, color: primaryColor, display: 'block' },
                false
              )}
            >
              {partner.region}
            </span>
          </div>

          <div>
            <span style={fieldLabelStyle(false)}>VALID</span>
            <span
              style={cardText(
                { fontSize: 13, fontWeight: 600, color: primaryColor, display: 'block' },
                false
              )}
            >
              {new Date(partner.createdAt).getFullYear()} — Active
            </span>
          </div>
        </div>
      </div>

      <CardFooterBar
        colors={colors}
        phone={partner.phone}
        website="partners.scholarnerve.com"
        email={partner.email}
        primaryColor={primaryColor}
      />
    </CardShell>
  );
}
