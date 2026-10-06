import 'dotenv/config';
import { config } from '@keystone-6/core';
import { session, withAuth } from './auth';
import { lists } from './lists';
import { seedDemoData } from './seed';

export default withAuth(
  config({
    db: {
      provider: 'postgresql',
      // ค่าจาก .env — เมื่อรันใน Docker compose จะถูก override ด้วย environment ของ compose
      url: process.env.DATABASE_URL || 'postgresql://movie_user:movie_pass@localhost:5432/movie_booking',
      // สร้างข้อมูลตัวอย่างอัตโนมัติเมื่อต่อฐานข้อมูลสำเร็จ (รันครั้งแรกเมื่อ DB ว่างเปล่า)
      onConnect: seedDemoData,
    },
    lists,
    session,
    graphql: {
      // เปิด GraphQL Playground เพื่อให้ทดสอบ API (รวมถึง Forgot Password) ได้ทันที
      playground: true,
    },
    ui: {
      // ต้องล็อกอินก่อนจึงจะเข้าถึง Admin UI ได้
      isAccessAllowed: (context) => !!context.session,
    },
    server: {
      port: Number(process.env.PORT || 3000),
    },
  })
);
