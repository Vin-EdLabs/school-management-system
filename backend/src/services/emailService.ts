/**
 * Sends admin alert emails. Uses console logging when SMTP is not configured.
 */
import type Transporter from 'nodemailer/lib/mailer/index.js';

type MailAttachment = {
  filename: string;
  content: Buffer;
  cid?: string;
  contentType?: string;
  contentDisposition?: 'inline' | 'attachment';
};

type MailPayload = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
};

function buildSmtpTransporter(host: string, port: number) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS?.replace(/\s/g, '');
  return {
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
    requireTLS: port === 587,
    tls: { minVersion: 'TLSv1.2' as const },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 20_000,
  };
}

async function sendWithTransporter(
  transporter: Transporter,
  payload: MailPayload,
): Promise<void> {
  await transporter.sendMail(payload);
}

export async function sendAdminEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}): Promise<boolean> {
  const { to, subject, text, html, attachments } = opts;
  if (!to) {
    console.warn('[email] No recipient — skipped:', subject);
    return false;
  }

  const host = process.env.SMTP_HOST;
  const configuredPort = Number(process.env.SMTP_PORT || 587);
  const from = process.env.SMTP_FROM || process.env.ADMIN_ALERT_FROM || 'noreply@scholarnerve.com';

  if (!host) {
    console.log(`[email] (dev/log mode)\nTo: ${to}\nSubject: ${subject}\n---\n${text}\n---`);
    return true;
  }

  const payload: MailPayload = {
    from,
    to,
    subject,
    text,
    html: html || text.replace(/\n/g, '<br/>'),
    attachments,
  };

  const nodemailer = await import('nodemailer');
  const portsToTry = [...new Set([
    configuredPort,
    ...(host.includes('gmail.com') && configuredPort !== 465 ? [465] : []),
    ...(configuredPort !== 587 ? [587] : []),
  ])];

  let lastError: unknown;
  for (const port of portsToTry) {
    const transporter = nodemailer.createTransport(buildSmtpTransporter(host, port));
    try {
      await sendWithTransporter(transporter, payload);
      if (port !== configuredPort) {
        console.warn(`[email] Sent via fallback SMTP port ${port} (configured port ${configuredPort} failed)`);
      }
      return true;
    } catch (err) {
      lastError = err;
      console.error(`[email] Send failed on port ${port}:`, err);
    } finally {
      transporter.close();
    }
  }

  console.log(`[email fallback log]\nTo: ${to}\nSubject: ${subject}\n${text}`);
  console.error('[email] All SMTP attempts failed:', lastError);
  return false;
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
