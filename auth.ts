import { createAuth } from '@keystone-6/auth';
import { statelessSessions } from '@keystone-6/core/session';
import type { Session } from './access';
import { sendPasswordResetEmail } from './mail';

/** อายุของ session: 7 วัน */
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * ระบบ session แบบ stateless (เก็บข้อมูลไว้ใน cookie ที่เข้ารหัสด้วย SESSION_SECRET)
 * - ต้องตั้ง secure: false เพราะระบบเดโมรันผ่าน HTTP (localhost)
 *   ถ้า secure เป็น true เบราว์เซอร์จะไม่เก็บ cookie → เข้าสู่ระบบไม่ได้
 */
export const session = statelessSessions<Session>({
  secret: process.env.SESSION_SECRET,
  maxAge: SESSION_MAX_AGE,
  cookieName: 'movieticket-session',
  secure: false,
});

const { withAuth } = createAuth({
  listKey: 'User',
  identityField: 'email',
  secretField: 'password',
  // ข้อมูลที่เก็บไว้ใน session เพื่อใช้ตรวจสอบสิทธิ์ (role) ใน access control
  sessionData: 'id name email role',
  // สร้างผู้ดูแลคนแรกอัตโนมัติเมื่อยังไม่มีผู้ใช้ในระบบเลย
  initFirstItem: {
    fields: ['name', 'email', 'password'],
    itemData: { role: 'Admin' },
    skipKeystoneWelcome: true,
  },
  // ระบบ "ลืมรหัสผ่าน" — ส่ง token ทางอีเมล (SMTP ชี้ไปที่ Mailpit)
  passwordResetLink: {
    tokensValidForMins: 30,
    sendToken: async ({ identity, token, context }) => {
      const user = await context.sudo().db.User.findOne({ where: { email: identity } });
      const name = typeof user?.name === 'string' ? user.name : undefined;
      await sendPasswordResetEmail({ to: identity, token, name });
    },
  },
});

export { withAuth };
