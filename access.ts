/**
 * นิยาม session และฟังก์ชันตรวจสอบสิทธิ์ (Access Control) ที่ใช้ร่วมกันทุก list
 *
 * บทบาทในระบบ:
 *   - Admin : ผู้ดูแล — จัดการหนัง/รอบฉาย/ผู้ใช้ ดูตั๋วได้ทุกฉบับ แต่ "ห้ามจองตั๋ว"
 *   - User  : ผู้ใช้ทั่วไป — จอง/ยกเลิกตั๋วของตัวเองเท่านั้น
 */

export type Session = {
  listKey: string;
  itemId: string;
  data: {
    id: string;
    name: string;
    email: string;
    role: 'Admin' | 'User';
  };
};

/** ต้องล็อกอินก่อนจึงจะทำรายการได้ */
export function isSignedIn({ session }: { session?: Session }) {
  return !!session;
}

/** ต้องเป็นผู้ดูแล (Admin) เท่านั้น */
export function isAdmin({ session }: { session?: Session }) {
  return session?.data?.role === 'Admin';
}

/** กติกาสำคัญของระบบนี้: "Admin ห้ามจองตั๋ว" — ต้องเป็นผู้ใช้สถานะ User เท่านั้น */
export function isBookingUser({ session }: { session?: Session }) {
  return !!session && session.data.role === 'User';
}

/** กรองข้อมูลให้เห็นเฉพาะของตัวเอง ยกเว้น Admin ที่เห็นทุกแถว */
export function ownItemFilter({ session }: { session?: Session }): boolean | { id: { equals: string } } {
  if (!session) return false;
  if (isAdmin({ session })) return true;
  return { id: { equals: session.itemId } };
}
