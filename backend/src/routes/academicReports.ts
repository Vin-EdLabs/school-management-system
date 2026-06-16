import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

function normalizeDateParam(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.split('T')[0];
}

/** Infer Sept–Aug term window when academic_terms rows lack dates. */
function inferTermBounds(termName: string, yearKey: string): { start: string; end: string } {
  const y = parseInt(String(yearKey).replace(/\D/g, '').slice(0, 4), 10) || new Date().getFullYear();
  const t = String(termName || '').toLowerCase();
  if (t.includes('1')) return { start: `${y}-09-01`, end: `${y}-12-31` };
  if (t.includes('2')) return { start: `${y + 1}-01-01`, end: `${y + 1}-04-30` };
  if (t.includes('3')) return { start: `${y + 1}-05-01`, end: `${y + 1}-08-31` };
  return { start: `${y}-09-01`, end: `${y + 1}-08-31` };
}

function resolveTermWindow(req: AuthRequest): { tenantId: number; termStart: string; termEnd: string } | null {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return null;

  let termStart = normalizeDateParam(req.query.termStart);
  let termEnd = normalizeDateParam(req.query.termEnd);

  if (!termStart || !termEnd) {
    const termName = String(req.query.termName || req.query.term || '').trim();
    const year = String(req.query.year || '').trim();
    if (termName && year) {
      const inferred = inferTermBounds(termName, year);
      termStart = termStart || inferred.start;
      termEnd = termEnd || inferred.end;
    }
  }

  if (!termStart || !termEnd) return null;
  return { tenantId, termStart, termEnd };
}

/**
 * GET /api/reports/academic/admissions-count
 */
router.get('/academic/admissions-count', async (req: AuthRequest, res) => {
  try {
    const window = resolveTermWindow(req);
    if (!window) {
      return res.status(400).json({ error: 'termStart and termEnd (or termName + year) are required' });
    }
    const { tenantId, termStart, termEnd } = window;
    const { start, end } = clampMonthToTerm(termStart, termEnd, String(req.query.month || 'all'));

    const result = await query(
      `SELECT COUNT(*)::int AS count FROM students
       WHERE tenant_id = $1
         AND date_of_admission IS NOT NULL
         AND date_of_admission >= $2::date
         AND date_of_admission <= $3::date`,
      [tenantId, start, end]
    );

    res.json({ count: Number(result.rows[0]?.count ?? 0) });
  } catch (error) {
    console.error('Error fetching admissions count:', error);
    res.status(500).json({ error: 'Failed to fetch admissions count' });
  }
});

/**
 * GET /api/reports/academic/admissions-by-month
 */
router.get('/academic/admissions-by-month', async (req: AuthRequest, res) => {
  try {
    const window = resolveTermWindow(req);
    if (!window) {
      return res.status(400).json({ error: 'termStart and termEnd (or termName + year) are required' });
    }
    const { tenantId, termStart, termEnd } = window;

    const result = await query(
      `SELECT TO_CHAR(date_of_admission, 'YYYY-MM') AS month, COUNT(*)::int AS count
       FROM students
       WHERE tenant_id = $1
         AND date_of_admission IS NOT NULL
         AND date_of_admission >= $2::date
         AND date_of_admission <= $3::date
       GROUP BY 1
       ORDER BY 1 ASC`,
      [tenantId, termStart, termEnd]
    );

    const monthNames: Record<string, string> = {
      '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
      '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
    };

    const data = result.rows.map((row: { month: string; count: number }) => {
      const [, month] = row.month.split('-');
      return {
        month: monthNames[month] || month,
        count: Number(row.count),
        fullMonth: row.month,
      };
    });

    res.json(data);
  } catch (error) {
    console.error('Error fetching admissions by month:', error);
    res.status(500).json({ error: 'Failed to fetch admissions by month' });
  }
});

/**
 * GET /api/reports/academic/teachers-appointed
 */
router.get('/academic/teachers-appointed', async (req: AuthRequest, res) => {
  try {
    const window = resolveTermWindow(req);
    if (!window) {
      return res.status(400).json({ error: 'termStart and termEnd (or termName + year) are required' });
    }
    const { tenantId, termStart, termEnd } = window;
    const { start, end } = clampMonthToTerm(termStart, termEnd, String(req.query.month || 'all'));

    const result = await query(
      `SELECT COUNT(*)::int AS count FROM teachers
       WHERE tenant_id = $1
         AND COALESCE(employment_date, created_at::date) >= $2::date
         AND COALESCE(employment_date, created_at::date) <= $3::date`,
      [tenantId, start, end]
    );

    res.json({ count: Number(result.rows[0]?.count ?? 0) });
  } catch (error) {
    console.error('Error fetching teachers appointed:', error);
    res.status(500).json({ error: 'Failed to fetch teachers appointed' });
  }
});

/**
 * GET /api/reports/academic/students-left
 */
router.get('/academic/students-left', async (req: AuthRequest, res) => {
  try {
    const window = resolveTermWindow(req);
    if (!window) {
      return res.status(400).json({ error: 'termStart and termEnd (or termName + year) are required' });
    }
    const { tenantId, termStart, termEnd } = window;
    const { start, end } = clampMonthToTerm(termStart, termEnd, String(req.query.month || 'all'));

    const result = await query(
      `SELECT COUNT(*)::int AS count FROM students
       WHERE tenant_id = $1
         AND LOWER(COALESCE(enrollment_status, 'active')) IN ('inactive', 'withdrawn')
         AND updated_at::date >= $2::date
         AND updated_at::date <= $3::date`,
      [tenantId, start, end]
    );

    res.json({ count: Number(result.rows[0]?.count ?? 0) });
  } catch (error) {
    console.error('Error fetching students left:', error);
    res.status(500).json({ error: 'Failed to fetch students left' });
  }
});

/**
 * GET /api/reports/academic/male-leavers
 */
router.get('/academic/male-leavers', async (req: AuthRequest, res) => {
  try {
    const window = resolveTermWindow(req);
    if (!window) {
      return res.status(400).json({ error: 'termStart and termEnd (or termName + year) are required' });
    }
    const { tenantId, termStart, termEnd } = window;
    const { start, end } = clampMonthToTerm(termStart, termEnd, String(req.query.month || 'all'));

    const result = await query(
      `SELECT COUNT(*)::int AS count FROM students
       WHERE tenant_id = $1
         AND LOWER(COALESCE(enrollment_status, 'active')) IN ('inactive', 'withdrawn')
         AND LOWER(TRIM(COALESCE(gender, ''))) = 'male'
         AND updated_at::date >= $2::date
         AND updated_at::date <= $3::date`,
      [tenantId, start, end]
    );

    res.json({ count: Number(result.rows[0]?.count ?? 0) });
  } catch (error) {
    console.error('Error fetching male leavers:', error);
    res.status(500).json({ error: 'Failed to fetch male leavers' });
  }
});

/**
 * GET /api/reports/academic/students-completed
 */
router.get('/academic/students-completed', async (req: AuthRequest, res) => {
  try {
    const window = resolveTermWindow(req);
    if (!window) {
      return res.status(400).json({ error: 'termStart and termEnd (or termName + year) are required' });
    }
    const { tenantId, termStart, termEnd } = window;
    const { start, end } = clampMonthToTerm(termStart, termEnd, String(req.query.month || 'all'));

    const result = await query(
      `SELECT COUNT(DISTINCT gd.student_id)::int AS count
       FROM graduation_details gd
       WHERE gd.tenant_id = $1
         AND gd.graduated_at::date >= $2::date
         AND gd.graduated_at::date <= $3::date`,
      [tenantId, start, end]
    );

    res.json({ count: Number(result.rows[0]?.count ?? 0) });
  } catch (error) {
    console.error('Error fetching students completed:', error);
    res.status(500).json({ error: 'Failed to fetch students completed' });
  }
});

/**
 * GET /api/reports/academic/enrollment-at-start
 */
router.get('/academic/enrollment-at-start', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const termStart = normalizeDateParam(req.query.termStart)
      || (req.query.termName && req.query.year
        ? inferTermBounds(String(req.query.termName), String(req.query.year)).start
        : null);

    if (!tenantId || !termStart) {
      return res.status(400).json({ error: 'termStart (or termName + year) is required' });
    }

    const result = await query(
      `SELECT COUNT(*)::int AS count FROM students
       WHERE tenant_id = $1
         AND LOWER(COALESCE(enrollment_status, 'active')) = 'active'
         AND (date_of_admission IS NULL OR date_of_admission <= $2::date)`,
      [tenantId, termStart]
    );

    res.json({ count: Number(result.rows[0]?.count ?? 0) });
  } catch (error) {
    console.error('Error fetching enrollment at start:', error);
    res.status(500).json({ error: 'Failed to fetch enrollment at start' });
  }
});

/**
 * GET /api/reports/academic/enrollment-trend
 */
router.get('/academic/enrollment-trend', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId required' });
    }

    const n = parseInt(String(req.query.lastNTerms ?? '6'), 10) || 6;

    const result = await query(
      `SELECT at.id, at.term_name, at.year, at.start_date, at.end_date,
         (SELECT COUNT(*)::int FROM students s
          WHERE s.tenant_id = $1
            AND LOWER(COALESCE(s.enrollment_status, 'active')) = 'active'
            AND (s.date_of_admission IS NULL OR s.date_of_admission <= COALESCE(at.end_date, at.start_date, CURRENT_DATE))
         ) AS total_enrolled
       FROM academic_terms at
       WHERE at.tenant_id = $1
       ORDER BY COALESCE(at.start_date, at.created_at) DESC NULLS LAST, at.id DESC
       LIMIT $2`,
      [tenantId, n]
    );

    const data = [...result.rows].reverse().map((row: {
      term_name: string;
      year: string;
      total_enrolled: number;
    }) => ({
      term: `${row.term_name} ${row.year}`.trim(),
      enrolled: Number(row.total_enrolled ?? 0),
      year: row.year,
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching enrollment trend:', error);
    res.status(500).json({ error: 'Failed to fetch enrollment trend' });
  }
});

/**
 * GET /api/reports/academic/term-comparison
 */
router.get('/academic/term-comparison', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId required' });
    }

    const n = parseInt(String(req.query.lastNTerms ?? '4'), 10) || 4;

    const result = await query(
      `SELECT at.id, at.term_name, at.year, at.start_date, at.end_date,
         (SELECT COUNT(*)::int FROM students s
          WHERE s.tenant_id = $1
            AND s.date_of_admission IS NOT NULL
            AND s.date_of_admission >= COALESCE(at.start_date, '1900-01-01'::date)
            AND s.date_of_admission <= COALESCE(at.end_date, CURRENT_DATE)
         ) AS admissions,
         (SELECT COUNT(*)::int FROM students s
          WHERE s.tenant_id = $1
            AND LOWER(COALESCE(s.enrollment_status, 'active')) IN ('inactive', 'withdrawn')
            AND s.updated_at::date >= COALESCE(at.start_date, '1900-01-01'::date)
            AND s.updated_at::date <= COALESCE(at.end_date, CURRENT_DATE)
         ) AS leavers
       FROM academic_terms at
       WHERE at.tenant_id = $1
       ORDER BY COALESCE(at.start_date, at.created_at) DESC NULLS LAST, at.id DESC
       LIMIT $2`,
      [tenantId, n]
    );

    const data = [...result.rows].reverse().map((row: {
      term_name: string;
      year: string;
      admissions: number;
      leavers: number;
    }) => ({
      term: `${row.term_name} ${row.year}`.trim(),
      admissions: Number(row.admissions ?? 0),
      leavers: Number(row.leavers ?? 0),
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching term comparison:', error);
    res.status(500).json({ error: 'Failed to fetch term comparison' });
  }
});

/**
 * GET /api/reports/academic/gender-split-leavers
 */
router.get('/academic/gender-split-leavers', async (req: AuthRequest, res) => {
  try {
    const window = resolveTermWindow(req);
    if (!window) {
      return res.status(400).json({ error: 'termStart and termEnd (or termName + year) are required' });
    }
    const { tenantId, termStart, termEnd } = window;

    const result = await query(
      `SELECT
         CASE
           WHEN LOWER(TRIM(COALESCE(gender, ''))) IN ('male', 'm') THEN 'Male'
           WHEN LOWER(TRIM(COALESCE(gender, ''))) IN ('female', 'f') THEN 'Female'
           ELSE 'Unknown'
         END AS gender,
         COUNT(*)::int AS count
       FROM students
       WHERE tenant_id = $1
         AND LOWER(COALESCE(enrollment_status, 'active')) IN ('inactive', 'withdrawn')
         AND updated_at::date >= $2::date
         AND updated_at::date <= $3::date
       GROUP BY 1
       ORDER BY 1`,
      [tenantId, termStart, termEnd]
    );

    const data = result.rows.map((row: { gender: string; count: number }) => ({
      name: row.gender,
      value: Number(row.count),
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching gender split leavers:', error);
    res.status(500).json({ error: 'Failed to fetch gender split leavers' });
  }
});

function buildSearchClause(search: string | undefined, startParam: number, alias = ''): { sql: string; params: string[] } {
  const q = String(search || '').trim();
  if (!q) return { sql: '', params: [] };
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const p = `$${startParam}`;
  const a = alias ? `${alias}.` : '';
  return {
    sql: ` AND (
      COALESCE(${a}first_name, '') ILIKE ${p}
      OR COALESCE(${a}last_name, '') ILIKE ${p}
      OR COALESCE(${a}student_id, '') ILIKE ${p}
      OR COALESCE(${a}admission_number, '') ILIKE ${p}
      OR TRIM(COALESCE(${a}first_name, '') || ' ' || COALESCE(${a}last_name, '')) ILIKE ${p}
    )`,
    params: [like],
  };
}

function buildTeacherSearchClause(search: string | undefined, startParam: number): { sql: string; params: string[] } {
  const q = String(search || '').trim();
  if (!q) return { sql: '', params: [] };
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const p = `$${startParam}`;
  return {
    sql: ` AND (
      COALESCE(full_name, '') ILIKE ${p}
      OR COALESCE(staff_id, '') ILIKE ${p}
      OR COALESCE(email, '') ILIKE ${p}
      OR COALESCE(phone_number, '') ILIKE ${p}
    )`,
    params: [like],
  };
}

function clampMonthToTerm(
  termStart: string,
  termEnd: string,
  monthKey: string | null | undefined
): { start: string; end: string } {
  if (!monthKey || monthKey === 'all') return { start: termStart, end: termEnd };
  const match = String(monthKey).match(/^(\d{4})-(\d{2})$/);
  if (!match) return { start: termStart, end: termEnd };
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return {
    start: monthStart > termStart ? monthStart : termStart,
    end: monthEnd < termEnd ? monthEnd : termEnd,
  };
}

/**
 * GET /api/reports/academic/admins-count
 */
router.get('/academic/admins-count', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

    const result = await query(
      `SELECT COUNT(*)::int AS count FROM users
       WHERE tenant_id = $1
         AND role IN ('administrator', 'super-admin')
         AND COALESCE(is_active, true) = true`,
      [tenantId]
    );
    res.json({ count: Number(result.rows[0]?.count ?? 0) });
  } catch (error) {
    console.error('Error fetching admins count:', error);
    res.status(500).json({ error: 'Failed to fetch admins count' });
  }
});

/**
 * GET /api/reports/academic/leavers-by-month
 */
router.get('/academic/leavers-by-month', async (req: AuthRequest, res) => {
  try {
    const window = resolveTermWindow(req);
    if (!window) {
      return res.status(400).json({ error: 'termStart and termEnd (or termName + year) are required' });
    }
    const { tenantId, termStart, termEnd } = window;

    const result = await query(
      `SELECT TO_CHAR(updated_at, 'YYYY-MM') AS month, COUNT(*)::int AS count
       FROM students
       WHERE tenant_id = $1
         AND LOWER(COALESCE(enrollment_status, 'active')) IN ('inactive', 'withdrawn')
         AND updated_at::date >= $2::date
         AND updated_at::date <= $3::date
       GROUP BY 1
       ORDER BY 1 ASC`,
      [tenantId, termStart, termEnd]
    );

    const monthNames: Record<string, string> = {
      '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
      '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
    };

    res.json(
      result.rows.map((row: { month: string; count: number }) => {
        const [, month] = row.month.split('-');
        return { month: monthNames[month] || month, count: Number(row.count), fullMonth: row.month };
      })
    );
  } catch (error) {
    console.error('Error fetching leavers by month:', error);
    res.status(500).json({ error: 'Failed to fetch leavers by month' });
  }
});

/**
 * GET /api/reports/academic/students-left-list
 */
router.get('/academic/students-left-list', async (req: AuthRequest, res) => {
  try {
    const window = resolveTermWindow(req);
    if (!window) {
      return res.status(400).json({ error: 'termStart and termEnd (or termName + year) are required' });
    }
    const { tenantId, termStart, termEnd } = window;
    const { start, end } = clampMonthToTerm(termStart, termEnd, String(req.query.month || 'all'));
    const search = buildSearchClause(String(req.query.search || ''), 4);

    const result = await query(
      `SELECT s.id, s.student_id, s.admission_number,
         s.first_name, s.last_name, s.gender,
         c.class_name, s.enrollment_status,
         s.date_of_admission, s.updated_at AS left_date
       FROM students s
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       WHERE s.tenant_id = $1
         AND LOWER(COALESCE(s.enrollment_status, 'active')) IN ('inactive', 'withdrawn')
         AND s.updated_at::date >= $2::date
         AND s.updated_at::date <= $3::date
         ${search.sql}
       ORDER BY s.updated_at DESC, s.last_name ASC, s.first_name ASC
       LIMIT 500`,
      [tenantId, start, end, ...search.params]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students left list:', error);
    res.status(500).json({ error: 'Failed to fetch students left list' });
  }
});

/**
 * GET /api/reports/academic/students-admitted-list
 */
router.get('/academic/students-admitted-list', async (req: AuthRequest, res) => {
  try {
    const window = resolveTermWindow(req);
    if (!window) {
      return res.status(400).json({ error: 'termStart and termEnd (or termName + year) are required' });
    }
    const { tenantId, termStart, termEnd } = window;
    const { start, end } = clampMonthToTerm(termStart, termEnd, String(req.query.month || 'all'));
    const search = buildSearchClause(String(req.query.search || ''), 4);

    const result = await query(
      `SELECT s.id, s.student_id, s.admission_number,
         s.first_name, s.last_name, s.gender,
         c.class_name, s.enrollment_status, s.date_of_admission
       FROM students s
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       WHERE s.tenant_id = $1
         AND s.date_of_admission IS NOT NULL
         AND s.date_of_admission >= $2::date
         AND s.date_of_admission <= $3::date
         ${search.sql}
       ORDER BY s.date_of_admission DESC, s.last_name ASC
       LIMIT 500`,
      [tenantId, start, end, ...search.params]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students admitted list:', error);
    res.status(500).json({ error: 'Failed to fetch students admitted list' });
  }
});

/**
 * GET /api/reports/academic/teachers-appointed-list
 */
router.get('/academic/teachers-appointed-list', async (req: AuthRequest, res) => {
  try {
    const window = resolveTermWindow(req);
    if (!window) {
      return res.status(400).json({ error: 'termStart and termEnd (or termName + year) are required' });
    }
    const { tenantId, termStart, termEnd } = window;
    const { start, end } = clampMonthToTerm(termStart, termEnd, String(req.query.month || 'all'));
    const search = buildTeacherSearchClause(String(req.query.search || ''), 4);

    const result = await query(
      `SELECT t.id, t.staff_id, t.full_name, t.gender, t.phone_number, t.email,
         t.employment_date, t.employment_status, t.created_at,
         c.class_name AS assigned_class
       FROM teachers t
       LEFT JOIN classes c ON t.class_assigned_id = c.id
       WHERE t.tenant_id = $1
         AND COALESCE(t.employment_date, t.created_at::date) >= $2::date
         AND COALESCE(t.employment_date, t.created_at::date) <= $3::date
         ${search.sql}
       ORDER BY COALESCE(t.employment_date, t.created_at::date) DESC, t.full_name ASC
       LIMIT 500`,
      [tenantId, start, end, ...search.params]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teachers appointed list:', error);
    res.status(500).json({ error: 'Failed to fetch teachers appointed list' });
  }
});

/**
 * GET /api/reports/academic/students-completed-list
 */
router.get('/academic/students-completed-list', async (req: AuthRequest, res) => {
  try {
    const window = resolveTermWindow(req);
    if (!window) {
      return res.status(400).json({ error: 'termStart and termEnd (or termName + year) are required' });
    }
    const { tenantId, termStart, termEnd } = window;
    const { start, end } = clampMonthToTerm(termStart, termEnd, String(req.query.month || 'all'));
    const search = buildSearchClause(String(req.query.search || ''), 4, 's');

    const result = await query(
      `SELECT s.id, s.student_id, s.admission_number,
         s.first_name, s.last_name, s.gender,
         cl.class_name, gd.graduated_at
       FROM graduation_details gd
       JOIN students s ON s.id = gd.student_id
       LEFT JOIN classes cl ON gd.class_id = cl.id
       WHERE gd.tenant_id = $1
         AND gd.graduated_at::date >= $2::date
         AND gd.graduated_at::date <= $3::date
         ${search.sql}
       ORDER BY gd.graduated_at DESC, s.last_name ASC
       LIMIT 500`,
      [tenantId, start, end, ...search.params]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students completed list:', error);
    res.status(500).json({ error: 'Failed to fetch students completed list' });
  }
});

export default router;
