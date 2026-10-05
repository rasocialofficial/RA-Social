const cleanEnv = (value) => String(value || '').trim();

/**
 * Checks if the email sending service is configured.
 * Now uses Brevo's HTTPS API instead of raw Gmail SMTP,
 * because Render's free plan blocks outbound SMTP ports (25, 465, 587).
 */
export function isGmailConfigured() {
  return Boolean(cleanEnv(process.env.BREVO_API_KEY) && cleanEnv(process.env.GMAIL_USER));
}

/**
 * Sends an email via Brevo's HTTPS API (works fine on Render's free plan
 * since it's a normal HTTPS call, not raw SMTP).
 *
 * Required env vars on Render:
 *   BREVO_API_KEY  - from Brevo dashboard: SMTP & API > API Keys
 *   GMAIL_USER     - the verified sender email, e.g. rasocialofficial@gmail.com
 *                    (must be verified as a "Sender" in Brevo first)
 */
export async function sendGmail({ to, subject, text, replyTo, inReplyTo }) {
  const apiKey = cleanEnv(process.env.BREVO_API_KEY);
  const fromEmail = cleanEnv(process.env.GMAIL_USER) || 'rasocialofficial@gmail.com';

  if (!apiKey) {
    throw new Error('Email service is not configured. Add BREVO_API_KEY in Render Environment.');
  }
  if (!to || !/^\S+@\S+\.\S+$/.test(String(to).trim())) {
    throw new Error('A valid recipient email is required.');
  }

  const payload = {
    sender: { email: fromEmail, name: 'RA Social' },
    to: [{ email: String(to).trim() }],
    subject: subject || 'RA Social Support',
    textContent: text || '',
  };
  if (replyTo) payload.replyTo = { email: replyTo };
  if (inReplyTo) payload.headers = { 'In-Reply-To': inReplyTo };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errJson = await response.json();
      detail = errJson?.message || JSON.stringify(errJson);
    } catch {
      detail = await response.text();
    }
    throw new Error(`Email send failed (${response.status}): ${detail}`);
  }

  return { success: true, from: fromEmail, to: String(to).trim() };
}
