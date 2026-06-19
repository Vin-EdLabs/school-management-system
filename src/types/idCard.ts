export type CardEntityType = 'STUDENT' | 'STAFF';
export type CardStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export type IDCardColors = {
  primaryColor: string;
  accentColor: string;
  footerBg: string;
  poweredByColor: string;
};

export type IDCardData = {
  schoolName: string;
  motto: string;
  schoolCode: string;
  phone: string;
  website: string;
  email: string;
  logoUrl: string | null;
  photoUrl: string | null;
  photoBase64: string | null;
  qrUrl: string;
  fullName: string;
  idNumber: string;
  academicYear?: string;
  className?: string;
  position?: string;
  department?: string;
  propertyHeader: string;
  instructions: string[];
  scanLabel: string;
};

export const CARD_WIDTH_PX = 560;
export const CARD_HEIGHT_PX = 350;

export const DEFAULT_STUDENT_COLORS: IDCardColors = {
  primaryColor: '#1a3a6b',
  accentColor: '#c9a227',
  footerBg: '#1a3a6b',
  poweredByColor: '#ffffff',
};

export const DEFAULT_STAFF_COLORS: IDCardColors = {
  primaryColor: '#1a3a6b',
  accentColor: '#c9a227',
  footerBg: '#1a3a6b',
  poweredByColor: '#ffffff',
};

export type IDCardSearchResult = {
  id: number;
  fullName: string;
  idNumber: string;
  photoUrl: string | null;
  className?: string;
  academicYear?: string;
  position?: string;
  department?: string;
  staffType?: 'teacher' | 'other';
  hasGeneratedCard?: boolean;
};

export type IDCardTemplateConfig = {
  cardType: CardEntityType;
  primaryColor: string;
  accentColor: string;
  footerBg: string;
  poweredByColor: string;
  schoolSlogan: string;
  schoolPhone: string;
  schoolWebsite: string;
  schoolCode: string;
  schoolEmail: string;
  backHeaderText: string;
  instructions: string[];
};

export type GeneratedIDCardRecord = {
  id: number;
  entityType: CardEntityType;
  entityId: number;
  cardData: IDCardData;
  generatedBy: number | null;
  generatedByName?: string | null;
  generatedAt: string;
  status: CardStatus;
  fullName?: string;
  idNumber?: string;
};
