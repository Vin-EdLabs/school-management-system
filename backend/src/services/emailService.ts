/**
 * Sends admin alert emails. Uses console logging when SMTP is not configured.
 */
export async function sendAdminEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const { to, subject, text, html } = opts;
  if (!to) {
    console.warn('[email] No recipient — skipped:', subject);
    return false;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.ADMIN_ALERT_FROM || 'noreply@scholarnerve.com';

  if (!host) {
    console.log(`[email] (dev/log mode)\nTo: ${to}\nSubject: ${subject}\n---\n${text}\n---`);
    return true;
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br/>'),
    });
    return true;
  } catch (err) {
    console.error('[email] Send failed:', err);
    console.log(`[email fallback log]\nTo: ${to}\nSubject: ${subject}\n${text}`);
    return false;
  }
}

export async function getPrimaryAdminEmail(tenantId: number): Promise<string | null> {
  const { query } = await import('../db/connection.js');
  const res = await query(
    `SELECT u.email FROM users u
     WHERE u.tenant_id = $1 AND u.is_primary_admin = true AND u.is_active = true
       AND u.email IS NOT NULL AND TRIM(u.email) <> ''
     ORDER BY u.id ASC LIMIT 1`,
    [tenantId]
  );
  if (res.rows[0]?.email) return String(res.rows[0].email);

  const fallback = await query(
    `SELECT u.email FROM users u
     WHERE u.tenant_id = $1 AND u.role IN ('administrator', 'admin') AND u.is_active = true
       AND u.email IS NOT NULL AND TRIM(u.email) <> ''
     ORDER BY u.is_primary_admin DESC NULLS LAST, u.id ASC LIMIT 1`,
    [tenantId]
  );
  return fallback.rows[0]?.email ? String(fallback.rows[0].email) : null;
}
