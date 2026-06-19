import React from 'react';
import { createPortal } from 'react-dom';
import type { CardEntityType, IDCardColors, IDCardData } from '@/types/idCard';
import { CARD_HEIGHT_PX, CARD_WIDTH_PX } from '@/types/idCard';
import StudentCardFront, { StudentCardBack } from './StudentCardFront';
import StaffCardFront, { StaffCardBack } from './StaffCardFront';

type PrintableCardProps = {
  entityType: CardEntityType;
  data: IDCardData;
  colors: IDCardColors;
};

const MM_PER_PX = 85.6 / CARD_WIDTH_PX;

function CardScaleWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: CARD_WIDTH_PX,
        height: CARD_HEIGHT_PX,
        transform: `scale(${MM_PER_PX})`,
        transformOrigin: 'top left',
      }}
    >
      {children}
    </div>
  );
}

const PrintableCard: React.FC<PrintableCardProps> = ({ entityType, data, colors }) => {
  const Front = entityType === 'STUDENT' ? StudentCardFront : StaffCardFront;
  const Back = entityType === 'STUDENT' ? StudentCardBack : StaffCardBack;

  const cutLine: React.CSSProperties = {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    border: '0.3px dashed #999999',
    borderRadius: '3.5mm',
    pointerEvents: 'none',
  };

  return createPortal(
    <div id="print-wrapper">
      <div
        id="print-container"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -9999,
          opacity: 0,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10mm',
          backgroundColor: '#ffffff',
        }}
      >
        <div style={{ width: '85.6mm', height: '54mm', position: 'relative', overflow: 'hidden' }}>
          <div style={cutLine} aria-hidden />
          <CardScaleWrap>
            <Front data={data} colors={colors} printMode />
          </CardScaleWrap>
        </div>
        <div style={{ width: '85.6mm', height: '54mm', position: 'relative', overflow: 'hidden' }}>
          <div style={cutLine} aria-hidden />
          <CardScaleWrap>
            <Back data={data} colors={colors} printMode />
          </CardScaleWrap>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PrintableCard;
