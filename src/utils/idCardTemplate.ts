export function renderIdCardTemplateText(text: string, schoolName: string): string {
  return String(text || '').replace(/\{schoolName\}/g, schoolName);
}

export function renderIdCardInstructions(instructions: string[], schoolName: string): string[] {
  return instructions.map((line) => renderIdCardTemplateText(line, schoolName));
}

export function normalizeHexColor(value: string): string {
  const raw = value.replace(/[^#0-9a-fA-F]/g, '');
  if (!raw) return '#000000';
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  const six = hex.slice(0, 6).padEnd(6, '0');
  return `#${six.toUpperCase()}`;
}
