import nodemailer from 'nodemailer';

/**
 * ส่งอีเมลผ่าน SMTP ของ Mailpit (จำลองเมลเซิร์ฟเวอร์)
 * - ภายใน Docker: SMTP_HOST=mailpit
 * - รันบนเครื่องตรง: SMTP_HOST=localhost (ค่าเริ่มต้น)
 * อีเมลทั้งหมดจะถูกดักไว้ที่ Mailpit UI: http://localhost:8025
 */
function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT || 1025),
    secure: false,
    // Mailpit ใช้ TLS แบบ self-signed — ข้ามการตรวจสอบเพื่อให้ส่งได้ในทุกสภาพแวดล้อม
    ignoreTLS: true,
  });
}

export async function sendPasswordResetEmail({
  to,
  token,
  name,
}: {
  to: string;
  token: string;
  name?: string | null;
}) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const mailpitUrl = `http://localhost:${process.env.MAILPIT_UI_PORT || 8025}`;
  const greeting = name ? `สวัสดี คุณ${name}` : 'สวัสดี';

  const text = [
    greeting,
    '',
    'คุณได้ขอรีเซ็ตรหัสผ่านของระบบ Movie Ticket Booking',
    '',
    `Token: ${token}`,
    '(อายุการใช้งาน 30 นาที และใช้ได้เพียงครั้งเดียว)',
    '',
    'วิธีนำไปใช้งาน:',
    `1. เปิด GraphQL Playground ที่ ${appUrl}/api/graphql`,
    '2. รันคำสั่ง Mutation ต่อไปนี้:',
    '',
    'mutation {',
    `  redeemUserPasswordResetToken(email: "${to}", token: "${token}", password: "NEW_PASSWORD_HERE") {`,
    '    code',
    '    message',
    '  }',
    '}',
    '',
    `หมายเหตุ: อีเมลฉบับนี้ถูกจำลองผ่าน Mailpit — เปิดดูกล่องจดหมายได้ที่ ${mailpitUrl}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="th">
<body style="font-family: Tahoma, Arial, sans-serif; background:#f4f6f8; padding:24px;">
  <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:8px; padding:28px; border:1px solid #e1e4e8;">
    <h2 style="margin-top:0; color:#1a73e8;">ระบบจองตั๋วหนัง</h2>
    <p>${greeting}</p>
    <p>คุณได้ขอรีเซ็ตรหัสผ่านของระบบ Movie Ticket Booking<br/>
       อายุการใช้งาน 30 นาที และใช้ได้เพียงครั้งเดียว</p>
    <p style="background:#f0f4ff; border:1px dashed #1a73e8; padding:12px; border-radius:6px;">
      <b>Token:</b><br/><code style="font-size:14px;">${token}</code>
    </p>
    <p><b>วิธีนำไปใช้งาน</b></p>
    <ol>
      <li>เปิด GraphQL Playground ที่ <a href="${appUrl}/api/graphql">${appUrl}/api/graphql</a></li>
      <li>รันคำสั่งด้านล่างนี้ (แทนที่ NEW_PASSWORD_HERE ด้วยรหัสผ่านใหม่ของคุณ)</li>
    </ol>
    <pre style="background:#f6f8fa; padding:14px; border-radius:6px; overflow:auto;">mutation {
  redeemUserPasswordResetToken(
    email: "${to}",
    token: "${token}",
    password: "NEW_PASSWORD_HERE"
  ) {
    code
    message
  }
}</pre>
    <p style="color:#6a737d; font-size:13px;">อีเมลฉบับนี้ถูกจำลองผ่าน Mailpit — เปิดดูได้ที่ <a href="${mailpitUrl}">${mailpitUrl}</a></p>
  </div>
</body>
</html>`;

  await createTransport().sendMail({
    from: process.env.SMTP_FROM || 'MovieTicket-NoReply@movieticket.local',
    to,
    subject: '[Movie Ticket Booking] รหัสสำหรับรีเซ็ตรหัสผ่านของคุณ',
    text,
    html,
  });
}
