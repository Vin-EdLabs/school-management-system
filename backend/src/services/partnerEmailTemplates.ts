import {
  resolvePartnerPortalDirectUrl,
  resolvePartnerPortalEmailLinkUrl,
  resolvePublicAppUrl,
  type PartnerEmailUrlContext,
} from '../utils/publicAppUrl.js';

export type PartnerEmailTemplate =
  | 'application_received'
  | 'approved'
  | 'suspended'
  | 'restored'
  | 'rejected'
  | 'password_reset'
  | 'training_video'
  | 'custom';

export type PartnerEmailVars = {
  firstName: string;
  lastName?: string;
  partnerId?: string | null;
  note?: string | null;
  customSubject?: string;
  customBody?: string;
  resetLink?: string;
  videoTitle?: string;
  videoDescription?: string | null;
};

const SUPPORT_EMAIL = 'scholarnerve@gmail.com';
const SUPPORT_WHATSAPP = '053 193 2399';

export function partnerLogoUrl(urls?: PartnerEmailUrlContext): string {
  if (urls?.logoSrc) return urls.logoSrc;
  const base = urls?.publicAppUrl || resolvePublicAppUrl();
  return `${base}/partners/scholarnerve-partner-emblem.png`;
}

export function partnerLoginUrl(urls?: PartnerEmailUrlContext): string {
  return urls?.partnerLoginUrl || resolvePartnerPortalEmailLinkUrl('/login');
}

export function partnerDashboardUrl(urls?: PartnerEmailUrlContext): string {
  return urls?.partnerDashboardUrl || resolvePartnerPortalEmailLinkUrl('/dashboard');
}

export function partnerLoginDirectUrl(urls?: PartnerEmailUrlContext): string {
  return urls?.partnerLoginDirectUrl || resolvePartnerPortalDirectUrl('/login');
}

export function partnerDashboardDirectUrl(urls?: PartnerEmailUrlContext): string {
  return urls?.partnerDashboardDirectUrl || resolvePartnerPortalDirectUrl('/dashboard');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textToHtmlParagraphs(text: string): string {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export function wrapPartnerEmail(opts: {
  preheader?: string;
  heading: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
  accent?: 'emerald' | 'amber' | 'red';
  urls?: PartnerEmailUrlContext;
}): string {
  const accent = opts.accent || 'emerald';
  const headerBg =
    accent === 'red'
      ? 'linear-gradient(135deg,#991b1b 0%,#dc2626 100%)'
      : accent === 'amber'
        ? 'linear-gradient(135deg,#b45309 0%,#d97706 100%)'
        : 'linear-gradient(135deg,#065f46 0%,#059669 50%,#10b981 100%)';
  const btnBg = accent === 'red' ? '#dc2626' : accent === 'amber' ? '#d97706' : '#059669';
  const logo = partnerLogoUrl(opts.urls);
  const preheader = opts.preheader ? escapeHtml(opts.preheader) : '';

  const ctaBlock = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 8px;">
         <tr>
           <td style="border-radius:12px;background:${btnBg};">
             <a href="${escapeHtml(opts.cta.href)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
               ${escapeHtml(opts.cta.label)}
             </a>
           </td>
         </tr>
       </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:${headerBg};padding:32px 28px;text-align:center;">
              <img src="${logo}" alt="ScholarNerve Partner Network" width="72" height="72" style="display:block;margin:0 auto 16px;border-radius:16px;background:#ffffff;padding:8px;"/>
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.85);">ScholarNerve Partner Network</p>
              <h1 style="margin:10px 0 0;font-size:24px;font-weight:800;line-height:1.25;color:#ffffff;">${escapeHtml(opts.heading)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 24px;">
              ${opts.bodyHtml}
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Need help?</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                Email <a href="mailto:${SUPPORT_EMAIL}" style="color:#059669;font-weight:600;text-decoration:none;">${SUPPORT_EMAIL}</a>
                · WhatsApp <a href="https://wa.me/233531932399" style="color:#059669;font-weight:600;text-decoration:none;">${SUPPORT_WHATSAPP}</a>
              </p>
              <p style="margin:14px 0 0;font-size:11px;color:#94a3b8;">© ScholarNerve · School management made simple</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPartnerEmail(
  template: PartnerEmailTemplate,
  vars: PartnerEmailVars,
  urls?: PartnerEmailUrlContext
): { subject: string; html: string; text: string; preview: string } {
  const firstName = String(vars.firstName || 'Partner').trim();
  const login = partnerLoginUrl(urls);
  const loginDirect = urls?.partnerLoginDirectUrl || partnerLoginDirectUrl(urls);
  const dashboard = partnerDashboardUrl(urls);
  const dashboardDirect = urls?.partnerDashboardDirectUrl || partnerDashboardDirectUrl(urls);
  const emailUrls = urls;

  if (template === 'application_received') {
    const subject = 'We received your ScholarNerve Partner application';
    const text = `Hi ${firstName},\n\nThank you for applying to the ScholarNerve Partner Network!\n\nWe've received your application and our team will review it within 48 hours. You'll get an email once a decision is made.\n\nYou can sign in anytime to check your status:\n${loginDirect}\n\nWe're excited about the possibility of working with you.\n\nThe ScholarNerve Team`;
    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Hi <strong>${escapeHtml(firstName)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Thank you for applying to the <strong>ScholarNerve Partner Network</strong>! We've received your application and our team will review it within <strong>48 hours</strong>.</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">You'll receive another email once a decision is made. In the meantime, you can sign in to check your application status.</p>`;
    return {
      subject,
      text,
      preview: `Application received — review within 48 hours`,
      html: wrapPartnerEmail({
        preheader: 'Your partner application is under review.',
        heading: 'Application received ✓',
        bodyHtml,
        cta: { label: 'View application status', href: login },
        urls: emailUrls,
      }),
    };
  }

  if (template === 'approved') {
    const partnerId = vars.partnerId || '';
    const subject = 'Welcome to the ScholarNerve Partner Network 🎉';
    const text = `Hi ${firstName},\n\nCongratulations — your ScholarNerve Partner application has been approved!\n\nYour Partner ID: ${partnerId}\nOpen dashboard: ${dashboardDirect}\n\nSign in at ${loginDirect} if needed.\n\nComplete your training, refer schools, and earn 30% recurring commission every month (50% for the first 2 months of every school you bring).\n\nWelcome aboard,\nThe ScholarNerve Team`;
    const idBlock = partnerId
      ? `<div style="margin:20px 0;padding:16px 18px;border-radius:14px;background:#ecfdf5;border:1px solid #a7f3d0;">
           <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#047857;">Your Partner ID</p>
           <p style="margin:0;font-size:22px;font-weight:800;font-family:ui-monospace,monospace;color:#065f46;">${escapeHtml(partnerId)}</p>
         </div>`
      : '';
    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Hi <strong>${escapeHtml(firstName)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Congratulations — your application has been <strong>approved</strong>! You're now part of the ScholarNerve Partner Network.</p>
      ${idBlock}
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Complete your training, refer schools, and earn <strong>30% recurring commission</strong> every month — <strong>50% for the first 2 months</strong> of every school you bring.</p>`;
    return {
      subject,
      text,
      preview: `Approved — Partner ID ${partnerId || 'assigned'}`,
      html: wrapPartnerEmail({
        preheader: 'You are approved! Your Partner ID is ready.',
        heading: 'You are approved! 🎉',
        bodyHtml,
        cta: { label: 'Open partner dashboard', href: dashboard },
        urls: emailUrls,
      }),
    };
  }

  if (template === 'suspended') {
    const note = String(vars.note || '').trim();
    const subject = 'ScholarNerve Partner account suspended';
    const text = `Hi ${firstName},\n\nYour ScholarNerve Partner account has been suspended.${note ? `\n\nReason: ${note}` : ''}\n\nReferrals, training, commissions, and payouts are unavailable until your account is restored.\n\nIf you have questions, contact us at ${SUPPORT_EMAIL} or WhatsApp ${SUPPORT_WHATSAPP}.\n\nThe ScholarNerve Team`;
    const noteBlock = note
      ? `<div style="margin:20px 0;padding:16px 18px;border-radius:14px;background:#fef2f2;border:1px solid #fecaca;">
           <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b91c1c;">Reason</p>
           <p style="margin:0;font-size:14px;line-height:1.6;color:#991b1b;">${escapeHtml(note)}</p>
         </div>`
      : '';
    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Hi <strong>${escapeHtml(firstName)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Your ScholarNerve Partner account has been <strong>suspended</strong>. Referrals, training, commissions, and payouts are unavailable until your account is restored.</p>
      ${noteBlock}
      <p style="margin:0;font-size:15px;line-height:1.65;color:#334155;">Contact our team if you believe this was a mistake or need more information.</p>`;
    return {
      subject,
      text,
      preview: note ? `Suspended — ${note.slice(0, 80)}` : 'Account suspended',
      html: wrapPartnerEmail({
        preheader: 'Your partner account access has been suspended.',
        heading: 'Account suspended',
        bodyHtml,
        accent: 'red',
        urls: emailUrls,
      }),
    };
  }

  if (template === 'restored') {
    const note = String(vars.note || '').trim();
    const subject = 'Your ScholarNerve Partner account has been unsuspended';
    const text = `Hi ${firstName},\n\nGood news — your ScholarNerve Partner account has been unsuspended!${note ? `\n\nNote from our team: ${note}` : ''}\n\nOpen your dashboard: ${dashboardDirect}\n\nSign in at ${loginDirect} if needed.\n\nWelcome back,\nThe ScholarNerve Team`;
    const noteBlock = note
      ? `<div style="margin:20px 0;padding:16px 18px;border-radius:14px;background:#ecfdf5;border:1px solid #a7f3d0;">
           <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#047857;">Why your account was unsuspended</p>
           <p style="margin:0;font-size:14px;line-height:1.6;color:#065f46;">${escapeHtml(note)}</p>
         </div>`
      : '';
    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Hi <strong>${escapeHtml(firstName)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Good news — your ScholarNerve Partner account has been <strong>unsuspended</strong>. You can sign in and continue referring schools and earning commissions.</p>
      ${noteBlock}
      <p style="margin:0;font-size:15px;line-height:1.65;color:#334155;">Thank you for your patience. We're glad to have you back on the network.</p>`;
    return {
      subject,
      text,
      preview: note ? `Unsuspended — ${note.slice(0, 80)}` : 'Account unsuspended — welcome back',
      html: wrapPartnerEmail({
        preheader: 'Your partner account has been unsuspended.',
        heading: 'Account unsuspended ✓',
        bodyHtml,
        cta: { label: 'Open partner dashboard', href: dashboard },
        urls: emailUrls,
      }),
    };
  }

  if (template === 'password_reset') {
    const resetLink = String(vars.resetLink || login);
    const subject = 'Reset your ScholarNerve Partner password';
    const text = `Hi ${firstName},\n\nWe received a request to reset your partner portal password.\n\nReset your password (link expires in 1 hour):\n${resetLink}\n\nIf you didn't request this, you can ignore this email.\n\nThe ScholarNerve Team`;
    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Hi <strong>${escapeHtml(firstName)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">We received a request to reset your ScholarNerve Partner password. Tap the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
      <p style="margin:0;font-size:15px;line-height:1.65;color:#334155;">If you didn't request a reset, you can safely ignore this email.</p>`;
    return {
      subject,
      text,
      preview: 'Password reset link — expires in 1 hour',
      html: wrapPartnerEmail({
        preheader: 'Reset your partner portal password.',
        heading: 'Reset your password',
        bodyHtml,
        cta: { label: 'Choose new password', href: resetLink },
        urls: emailUrls,
      }),
    };
  }

  if (template === 'rejected') {
    const note = String(vars.note || '').trim();
    const subject = 'Update on your ScholarNerve Partner application';
    const text = `Hi ${firstName},\n\nThank you for applying to the ScholarNerve Partner Network. After review, we're unable to approve your application at this time.${note ? `\n\nNote from our team: ${note}` : ''}\n\nYou're welcome to reapply in the future.\n\nThe ScholarNerve Team`;
    const noteBlock = note
      ? `<div style="margin:20px 0;padding:16px 18px;border-radius:14px;background:#fffbeb;border:1px solid #fde68a;">
           <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b45309;">Note from our team</p>
           <p style="margin:0;font-size:14px;line-height:1.6;color:#92400e;">${escapeHtml(note)}</p>
         </div>`
      : '';
    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Hi <strong>${escapeHtml(firstName)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Thank you for applying to the ScholarNerve Partner Network. After review, we're unable to approve your application at this time.</p>
      ${noteBlock}
      <p style="margin:0;font-size:15px;line-height:1.65;color:#334155;">You're welcome to reapply in the future. We appreciate your interest in partnering with ScholarNerve.</p>`;
    return {
      subject,
      text,
      preview: note ? `Application update — ${note.slice(0, 80)}` : 'Application update',
      html: wrapPartnerEmail({
        preheader: 'An update on your partner application.',
        heading: 'Application update',
        bodyHtml,
        accent: 'amber',
        urls: emailUrls,
      }),
    };
  }

  if (template === 'training_video') {
    const videoTitle = String(vars.videoTitle || 'New training video').trim();
    const videoDescription = String(vars.videoDescription || '').trim();
    const trainingLink = resolvePartnerPortalEmailLinkUrl('/training');
    const trainingUrl = resolvePartnerPortalDirectUrl('/training');
    const subject = `New training video: ${videoTitle}`;
    const text = `Hi ${firstName},\n\nScholarNerve just published a new partner training video:\n\n${videoTitle}${videoDescription ? `\n\n${videoDescription}` : ''}\n\nWatch it in your partner portal:\n${trainingUrl}\n\nThe ScholarNerve Team`;
    const descBlock = videoDescription
      ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">${escapeHtml(videoDescription)}</p>`
      : '';
    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">Hi <strong>${escapeHtml(firstName)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">We just added a new training video to your partner dashboard:</p>
      <div style="margin:20px 0;padding:16px 18px;border-radius:14px;background:#ecfdf5;border:1px solid #a7f3d0;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#047857;">New video</p>
        <p style="margin:0;font-size:18px;font-weight:800;color:#065f46;">${escapeHtml(videoTitle)}</p>
      </div>
      ${descBlock}
      <p style="margin:0;font-size:15px;line-height:1.65;color:#334155;">Watch it now to stay sharp and close more schools with confidence.</p>`;
    return {
      subject,
      text,
      preview: videoTitle,
      html: wrapPartnerEmail({
        preheader: `New training: ${videoTitle}`,
        heading: 'New training video 🎬',
        bodyHtml,
        cta: { label: 'Watch training', href: trainingLink },
        urls: emailUrls,
      }),
    };
  }

  const subject = String(vars.customSubject || '').trim() || 'Message from ScholarNerve Partners';
  const body = String(vars.customBody || '').trim();
  const text = body || subject;
  const bodyHtml = textToHtmlParagraphs(body || subject);
  return {
    subject,
    text,
    preview: body.slice(0, 120) || subject,
    html: wrapPartnerEmail({
      preheader: subject,
      heading: subject,
      bodyHtml,
      cta: { label: 'Open partner dashboard', href: dashboard },
      urls: emailUrls,
    }),
  };
}
