/** Curated Unsplash campus / school-life images for demo website content. */

const IMAGE_QUALITY = 'auto=format&fit=crop&q=88';
const PORTRAIT_QUALITY = 'fit=crop&crop=faces&auto=format&q=92';

export const DEMO_CAMPUS_IMAGES: Record<string, string> = {
  hero: `https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1920&h=1080&${IMAGE_QUALITY}`,
  welcome_primary: `https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&h=1000&${IMAGE_QUALITY}`,
  welcome_secondary: `https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=750&${IMAGE_QUALITY}`,
  history: `https://images.unsplash.com/photo-1562774053-701939374585?w=900&h=700&${IMAGE_QUALITY}`,
  overview: `https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=900&h=700&${IMAGE_QUALITY}`,
  head_of_school_portrait: `https://images.unsplash.com/photo-1580489944761-15a19d654956?w=900&h=1125&${PORTRAIT_QUALITY}`,
  classroom: `https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&h=600&${IMAGE_QUALITY}`,
  reading: `https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&${IMAGE_QUALITY}`,
  science_lab: `https://images.unsplash.com/photo-1532094349884-54311bbfbc7f?w=800&h=600&${IMAGE_QUALITY}`,
  ict: `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&${IMAGE_QUALITY}`,
  arts: `https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=600&${IMAGE_QUALITY}`,
  sports: `https://images.unsplash.com/photo-1461896836934-ffe607ba8121?w=800&h=600&${IMAGE_QUALITY}`,
  assembly: `https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&h=600&${IMAGE_QUALITY}`,
  playground: `https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&h=600&${IMAGE_QUALITY}`,
  library: `https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&${IMAGE_QUALITY}`,
  graduation: `https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800&h=600&${IMAGE_QUALITY}`,
  canteen: `https://images.unsplash.com/photo-1541339907192-e08756dedf3f?w=800&h=600&${IMAGE_QUALITY}`,
  event_open_day: `https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&h=700&${IMAGE_QUALITY}`,
  event_sports: `https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&h=700&${IMAGE_QUALITY}`,
  event_pta: `https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&h=700&${IMAGE_QUALITY}`,
  event_culture: `https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&h=700&${IMAGE_QUALITY}`,
};

/** Sharp professional headshots for website management / team pages (not low-res passport uploads). */
export const DEMO_STAFF_PORTRAITS: Record<string, string> = {
  tch008: `https://images.unsplash.com/photo-1580489944761-15a19d654956?w=900&h=1125&${PORTRAIT_QUALITY}`,
  tch001: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&h=1125&${PORTRAIT_QUALITY}`,
  tch002: `https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=900&h=1125&${PORTRAIT_QUALITY}`,
  tch003: `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=900&h=1125&${PORTRAIT_QUALITY}`,
  tch004: `https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=900&h=1125&${PORTRAIT_QUALITY}`,
  tch005: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&h=1125&${PORTRAIT_QUALITY}`,
  tch006: `https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=900&h=1125&${PORTRAIT_QUALITY}`,
  tch007: `https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=900&h=1125&${PORTRAIT_QUALITY}`,
  tch009: `https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=900&h=1125&${PORTRAIT_QUALITY}`,
  tch010: `https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=900&h=1125&${PORTRAIT_QUALITY}`,
  stf001: `https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&h=1125&${PORTRAIT_QUALITY}`,
  stf002: `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=900&h=1125&${PORTRAIT_QUALITY}`,
  stf003: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&h=1125&${PORTRAIT_QUALITY}`,
};

export function getDemoCampusImage(key: string): string {
  return DEMO_CAMPUS_IMAGES[key] || DEMO_CAMPUS_IMAGES.hero;
}

export function getDemoStaffPortrait(teacherOrStaffKey: string): string | null {
  return DEMO_STAFF_PORTRAITS[teacherOrStaffKey] || null;
}

export function resolveDemoTeamPhoto(teacherKey?: string, staffKey?: string): string {
  if (teacherKey) {
    const portrait = getDemoStaffPortrait(teacherKey);
    if (portrait) return portrait;
  }
  if (staffKey) {
    const portrait = getDemoStaffPortrait(staffKey);
    if (portrait) return portrait;
  }
  return getDemoCampusImage('head_of_school_portrait');
}
