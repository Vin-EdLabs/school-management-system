/** JHS 3 is the only class level that moves wholesale to Alumni (not promoted up). */
export function isJhs3Class(cls: { level?: string; className?: string }): boolean {
  const hay = `${cls.level || ''} ${cls.className || ''}`.toLowerCase();
  return /\bjhs\s*3\b/.test(hay) || hay.includes('jhs3') || /\bjhs\s*iii\b/.test(hay);
}

export function findClassByNameOrId(
  classes: { id: string; className: string }[],
  ref: string
) {
  return classes.find((c) => c.id === ref || c.className === ref);
}
