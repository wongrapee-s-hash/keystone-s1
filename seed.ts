import type { KeystoneContext } from '@keystone-6/core/types';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** สร้างวัน-เวลา ISO string ห่างจากตอนนี้ offsetMs มิลลิวินาที */
function inTheFuture(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

/**
 * สร้างข้อมูลตัวอย่างเมื่อฐานข้อมูลยังว่างเปล่า (idempotent — รันซ้ำได้)
 * ประกอบด้วย: ผู้ใช้ 2 ราย (Admin/User), ภาพยนตร์ 3 เรื่อง,
 *             รอบฉาย 5 รอบ และตั๋วตัวอย่าง 1 ฉบับ
 */
export async function seedDemoData(context: KeystoneContext): Promise<void> {
  try {
    const db = context.sudo().db;

    const userCount = await db.User.count();
    if (userCount > 0) return;

    console.log('[seed] ฐานข้อมูลว่างเปล่า — กำลังสร้างข้อมูลตัวอย่าง...');

    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@movieticket.local';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@1234';
    const userEmail = process.env.SEED_USER_EMAIL || 'user@movieticket.local';
    const userPassword = process.env.SEED_USER_PASSWORD || 'User@1234';

    const admin = await db.User.createOne({
      data: { name: 'ผู้ดูแลระบบ (Admin)', email: adminEmail, password: adminPassword, role: 'Admin' },
    });
    const user = await db.User.createOne({
      data: { name: 'ผู้ใช้ทั่วไป (User)', email: userEmail, password: userPassword, role: 'User' },
    });

    const interstellar = await db.Movie.createOne({
      data: {
        title: 'Interstellar',
        synopsis:
          'เมื่อโลกใกล้ล่มสลาย กลุ่มนักบินอวกาศต้องข้ามหลุมดำเพื่อหาบ้านหลังใหม่ของมวลมนุษยชาติ',
        genre: 'SCI_FI',
        durationInMinutes: 169,
        ageRating: 'PG13',
      },
    });
    const titanic = await db.Movie.createOne({
      data: {
        title: 'Titanic',
        synopsis: 'เรื่องราวความรักของวัยรุ่นสองคนบนเรือเดินสมุทรที่หรูหราที่สุดในโลก',
        genre: 'ROMANCE',
        durationInMinutes: 195,
        ageRating: 'PG13',
      },
    });
    const darkKnight = await db.Movie.createOne({
      data: {
        title: 'The Dark Knight',
        synopsis: 'แบทแมนต้องเผชิญหน้ากับโจ๊กเกอร์ อาชญากรที่ต้องการทำให้เมืองก็อตแอมซียมล่มสลาย',
        genre: 'ACTION',
        durationInMinutes: 152,
        ageRating: 'PG13',
      },
    });

    const showtime1 = await db.Showtime.createOne({
      data: {
        movie: { connect: { id: interstellar.id } },
        startsAt: inTheFuture(DAY_MS + 11 * HOUR_MS),
        hall: 'Hall 1',
        price: 220,
      },
    });
    await db.Showtime.createOne({
      data: {
        movie: { connect: { id: interstellar.id } },
        startsAt: inTheFuture(DAY_MS + 18 * HOUR_MS),
        hall: 'Hall 3',
        price: 240,
      },
    });
    await db.Showtime.createOne({
      data: {
        movie: { connect: { id: titanic.id } },
        startsAt: inTheFuture(2 * DAY_MS + 14 * HOUR_MS),
        hall: 'Hall 2',
        price: 180,
      },
    });
    await db.Showtime.createOne({
      data: {
        movie: { connect: { id: darkKnight.id } },
        startsAt: inTheFuture(2 * DAY_MS + 20 * HOUR_MS),
        hall: 'Hall 1',
        price: 200,
      },
    });
    await db.Showtime.createOne({
      data: {
        movie: { connect: { id: darkKnight.id } },
        startsAt: inTheFuture(3 * DAY_MS + 16 * HOUR_MS),
        hall: 'Hall 2',
        price: 180,
      },
    });

    await db.Ticket.createOne({
      data: {
        user: { connect: { id: user.id } },
        movie: { connect: { id: interstellar.id } },
        showtime: { connect: { id: showtime1.id } },
        seats: 'A5, A6',
        status: 'CONFIRMED',
      },
    });

    console.log('[seed] สร้างข้อมูลตัวอย่างเรียบร้อยแล้ว');
    console.log(`[seed]   Admin: ${adminEmail} / ${adminPassword}`);
    console.log(`[seed]   User : ${userEmail} / ${userPassword}`);
    console.log(`[seed]   (admin id: ${admin.id}, user id: ${user.id})`);
  } catch (error) {
    // ไม่หยุดการทำงานของแอปถ้า seed ล้มเหลว (เช่น ยัง connect DB ไม่ได้)
    console.error('[seed] สร้างข้อมูลตัวอย่างไม่สำเร็จ:', error);
  }
}
