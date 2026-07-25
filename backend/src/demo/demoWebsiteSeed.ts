import type pg from 'pg';
import { query } from '../db/connection.js';
import { getDemoCampusImage, resolveDemoTeamPhoto } from './demoCampusImages.js';
import { loadDemoSeedData } from './demoSeedLoader.js';
import type { DemoSeedData } from './demoImportService.js';

export type DemoWebsiteSeedResult = {
  gallery: number;
  events: number;
  teamMembers: number;
};

type IdMap = Map<string, number>;

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type WebsiteAboutSeed = {
  director_teacher_key?: string;
  director_image_key?: string;
  director_title?: string;
  director_name?: string;
  director_message?: string;
  history?: string;
  vision?: string;
  mission?: string;
  core_values?: string[];
  institution_overview?: string;
  history_image_key?: string;
  overview_image_key?: string;
};

type WebsiteAdmissionSeed = {
  requirements?: string;
  programs?: string[];
  applications_open?: boolean;
  open_date?: string;
  close_date?: string;
};

function resolveImage(key: string | undefined, fallback = 'hero'): string {
  return getDemoCampusImage(key || fallback);
}

function teacherByKey(seed: DemoSeedData, key: string) {
  return seed.teachers.find((t) => t.key === key);
}

function subjectName(seed: DemoSeedData, subjectKey: string): string {
  return seed.subjects.find((s) => s.key === subjectKey)?.name || subjectKey;
}

export async function seedDemoWebsiteContent(
  client: pg.PoolClient,
  tenantId: number,
  seed: DemoSeedData,
  ids: IdMap,
  opts: { studentCount: number; classCount: number; schoolName: string }
): Promise<DemoWebsiteSeedResult> {
  const ws = seed.website_seed;
  if (!ws) return { gallery: 0, events: 0, teamMembers: 0 };

  const studentCount = ws.stats?.student_count ?? opts.studentCount;
  const programsCount = ws.stats?.programs_count ?? opts.classCount;
  const stats = {
    founded_year: ws.stats?.founded_year ?? 2008,
    student_count: studentCount,
    programs_count: programsCount,
    pass_rate: ws.stats?.pass_rate ?? '96%',
  };

  const homeContent = ws.home_content || {};
  const highlights = ws.highlights || [];
  const socialLinks = ws.social_links || {};

  await client.query(
    `INSERT INTO school_websites (tenant_id, is_enabled, is_published, accent_color, banner_image_url, tagline,
       welcome_text, welcome_image_url, welcome_image_secondary_url, home_content, highlights, stats, social_links)
     VALUES ($1, $2, true, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb)
     ON CONFLICT (tenant_id) DO UPDATE SET
       is_enabled = EXCLUDED.is_enabled,
       is_published = true,
       accent_color = EXCLUDED.accent_color,
       banner_image_url = EXCLUDED.banner_image_url,
       tagline = EXCLUDED.tagline,
       welcome_text = EXCLUDED.welcome_text,
       welcome_image_url = EXCLUDED.welcome_image_url,
       welcome_image_secondary_url = EXCLUDED.welcome_image_secondary_url,
       home_content = EXCLUDED.home_content,
       highlights = EXCLUDED.highlights,
       stats = EXCLUDED.stats,
       social_links = EXCLUDED.social_links,
       updated_at = NOW()`,
    [
      tenantId,
      ws.auto_enable !== false,
      ws.accent_color || '#0c2340',
      resolveImage(ws.banner_image_key, 'hero'),
      ws.tagline || `Excellence in learning, character, and community.`,
      ws.welcome_text || null,
      resolveImage(ws.welcome_image_key, 'welcome_primary'),
      resolveImage(ws.welcome_image_secondary_key, 'welcome_secondary'),
      JSON.stringify(homeContent),
      JSON.stringify(highlights),
      JSON.stringify(stats),
      JSON.stringify(socialLinks),
    ]
  );

  const about: WebsiteAboutSeed = ws.about ?? {};
  const directorTeacherKey =
    about.director_teacher_key || ws.leadership?.[0]?.teacher_key || 'tch008';
  const headTeacher = teacherByKey(seed, directorTeacherKey);
  const directorImageKey = about.director_image_key || 'head_of_school_portrait';
  const directorPhoto = resolveImage(directorImageKey, 'head_of_school_portrait');

  await client.query(
    `INSERT INTO school_website_about (
       tenant_id, history, vision, mission, core_values, director_message, director_name, director_title,
       director_photo_url, institution_overview, history_image_url, overview_image_url
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (tenant_id) DO UPDATE SET
       history = EXCLUDED.history,
       vision = EXCLUDED.vision,
       mission = EXCLUDED.mission,
       core_values = EXCLUDED.core_values,
       director_message = EXCLUDED.director_message,
       director_name = EXCLUDED.director_name,
       director_title = EXCLUDED.director_title,
       director_photo_url = EXCLUDED.director_photo_url,
       institution_overview = EXCLUDED.institution_overview,
       history_image_url = EXCLUDED.history_image_url,
       overview_image_url = EXCLUDED.overview_image_url,
       updated_at = NOW()`,
    [
      tenantId,
      about.history || null,
      about.vision || null,
      about.mission || null,
      JSON.stringify(about.core_values || []),
      about.director_message || null,
      about.director_name || headTeacher?.full_name || null,
      about.director_title || 'Head of School',
      directorPhoto,
      about.institution_overview || null,
      resolveImage(about.history_image_key, 'history'),
      resolveImage(about.overview_image_key, 'overview'),
    ]
  );

  const admission: WebsiteAdmissionSeed = ws.admission ?? {};
  const openDate = admission.open_date || addDays(new Date(), -7);
  const closeDate = admission.close_date || addDays(new Date(), 90);
  const programs =
    admission.programs ||
    seed.classes.map((c) => c.class_name);

  await client.query(
    `INSERT INTO school_website_admission_config (tenant_id, requirements, programs, applications_open, open_date, close_date)
     VALUES ($1,$2,$3::jsonb,$4,$5::date,$6::date)
     ON CONFLICT (tenant_id) DO UPDATE SET
       requirements = EXCLUDED.requirements,
       programs = EXCLUDED.programs,
       applications_open = EXCLUDED.applications_open,
       open_date = EXCLUDED.open_date,
       close_date = EXCLUDED.close_date,
       updated_at = NOW()`,
    [
      tenantId,
      admission.requirements || null,
      JSON.stringify(programs),
      admission.applications_open !== false,
      openDate,
      closeDate,
    ]
  );

  const contact = ws.contact || {};
  await client.query(
    `INSERT INTO school_website_contact (tenant_id, primary_phone, secondary_phone, email, address, working_hours)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tenant_id) DO UPDATE SET
       primary_phone = EXCLUDED.primary_phone,
       secondary_phone = EXCLUDED.secondary_phone,
       email = EXCLUDED.email,
       address = EXCLUDED.address,
       working_hours = EXCLUDED.working_hours,
       updated_at = NOW()`,
    [
      tenantId,
      contact.primary_phone || headTeacher?.phone || '+233241001008',
      contact.secondary_phone || null,
      contact.email || headTeacher?.email || 'admissions@demo.school',
      contact.address || '12 Ring Road East, Accra, Ghana',
      contact.working_hours || 'Mon–Fri: 7:30 AM – 3:30 PM',
    ]
  );

  await client.query(`DELETE FROM school_website_gallery WHERE tenant_id = $1`, [tenantId]);
  let galleryCount = 0;
  for (const item of ws.gallery || []) {
    const url = resolveImage(item.image_key, 'classroom');
    await client.query(
      `INSERT INTO school_website_gallery (tenant_id, url, thumbnail_url, category, sort_order)
       VALUES ($1,$2,$2,$3,$4)`,
      [tenantId, url, item.category || 'facilities', item.sort_order ?? galleryCount]
    );
    galleryCount++;
  }

  await client.query(`DELETE FROM school_website_events WHERE tenant_id = $1`, [tenantId]);
  let eventCount = 0;
  const today = new Date();
  for (const ev of ws.events || []) {
    const eventDate = ev.event_date || addDays(today, ev.days_from_now ?? 14);
    await client.query(
      `INSERT INTO school_website_events (
         tenant_id, title, description, event_date, event_time, location, cover_image_url, is_published, sort_order
       ) VALUES ($1,$2,$3,$4::date,$5::time,$6,$7,true,$8)`,
      [
        tenantId,
        ev.title,
        ev.description || null,
        eventDate,
        ev.event_time || null,
        ev.location || null,
        resolveImage(ev.cover_image_key, 'event_open_day'),
        ev.sort_order ?? eventCount,
      ]
    );
    eventCount++;
  }

  await client.query(`DELETE FROM school_website_team_members WHERE tenant_id = $1`, [tenantId]);
  let teamCount = 0;

  for (const leader of ws.leadership || []) {
    let fullName = leader.full_name || null;
    if (leader.teacher_key) {
      const t = teacherByKey(seed, leader.teacher_key);
      fullName = fullName || t?.full_name || null;
    } else if (leader.staff_key) {
      const staff = seed.other_staff.find((s) => s.key === leader.staff_key);
      fullName = fullName || staff?.full_name || null;
    }
    const photoUrl = resolveDemoTeamPhoto(leader.teacher_key, leader.staff_key);
    await client.query(
      `INSERT INTO school_website_team_members
         (tenant_id, member_type, position, full_name, photo_url, bio, subjects, sort_order, is_published)
       VALUES ($1,'leadership',$2,$3,$4,$5,'[]'::jsonb,$6,true)`,
      [
        tenantId,
        leader.position || 'other',
        fullName || 'Leadership',
        photoUrl,
        leader.bio || null,
        leader.sort_order ?? teamCount,
      ]
    );
    teamCount++;
  }

  for (const teacher of ws.teachers || []) {
    const t = teacherByKey(seed, teacher.teacher_key);
    if (!t) continue;
    const subjects =
      teacher.subjects ||
      [subjectName(seed, t.primary_subject_key)];
    const photoUrl = resolveDemoTeamPhoto(teacher.teacher_key);
    await client.query(
      `INSERT INTO school_website_team_members
         (tenant_id, member_type, position, full_name, photo_url, bio, subjects, sort_order, is_published)
       VALUES ($1,'teacher',$2,$3,$4,$5,$6::jsonb,$7,true)`,
      [
        tenantId,
        teacher.position || t.position || 'Teacher',
        t.full_name,
        photoUrl,
        teacher.bio || null,
        JSON.stringify(subjects),
        teacher.sort_order ?? teamCount,
      ]
    );
    teamCount++;
  }

  return { gallery: galleryCount, events: eventCount, teamMembers: teamCount };
}

function loadWebsiteSeedGallery(): Array<{ image_key: string; category?: string; sort_order?: number }> {
  try {
    return loadDemoSeedData().website_seed?.gallery || [];
  } catch {
    return [];
  }
}

/** Idempotent — adds demo campus gallery photos when a demo school's gallery is empty (e.g. production before re-import). */
export async function ensureDemoWebsiteGalleryIfEmpty(tenantId: number): Promise<number> {
  const demoRes = await query(`SELECT is_demo FROM tenants WHERE id = $1`, [tenantId]);
  if (!demoRes.rows[0]?.is_demo) return 0;

  const countRes = await query(
    `SELECT COUNT(*)::int AS n FROM school_website_gallery WHERE tenant_id = $1`,
    [tenantId]
  );
  if (Number(countRes.rows[0]?.n ?? 0) > 0) return 0;

  const items = loadWebsiteSeedGallery();
  if (items.length === 0) return 0;

  let inserted = 0;
  for (const item of items) {
    const url = resolveImage(item.image_key, 'classroom');
    await query(
      `INSERT INTO school_website_gallery (tenant_id, url, thumbnail_url, category, sort_order)
       VALUES ($1,$2,$2,$3,$4)`,
      [tenantId, url, item.category || 'facilities', item.sort_order ?? inserted]
    );
    inserted++;
  }
  return inserted;
}
