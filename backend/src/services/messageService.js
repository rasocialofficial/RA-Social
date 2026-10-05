const cleanPhone = (value) => String(value || '').replace(/[^\d+]/g, '');

export const sendEmail = async ({ to, subject, html, text }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('Email service is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text: text || undefined })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend email failed: ${response.status} ${body}`);
  }
};

export const sendSms = async ({ to, body }) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const phone = cleanPhone(to);
  if (!sid || !token || !from) throw new Error('SMS service is not configured');
  if (!phone) throw new Error('A valid phone number is required for SMS');
  const params = new URLSearchParams({ To: phone, From: from, Body: body });
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params
  });
  if (!response.ok) {
    const data = await response.text().catch(() => '');
    throw new Error(`Twilio SMS failed: ${response.status} ${data}`);
  }
};

export const sendPasswordResetCode = async ({ user, otp }) => {
  const codeText = `Your RA Social password reset code is ${otp}. It expires in 10 minutes.`;
  const delivery = String(process.env.PASSWORD_RESET_DELIVERY || 'email').toLowerCase();
  if (delivery === 'sms') {
    if (!user.phoneNumber) throw new Error('SMS delivery selected but this account has no phone number');
    await sendSms({ to: user.phoneNumber, body: codeText });
    return 'sms';
  }
  await sendEmail({ to: user.email, subject: 'RA Social password reset OTP', html: `<p>${codeText}</p>`, text: codeText });
  return 'email';
};
