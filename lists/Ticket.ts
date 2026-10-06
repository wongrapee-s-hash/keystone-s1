import { list } from '@keystone-6/core';
import { relationship, select, text, timestamp } from '@keystone-6/core/fields';
import { isAdmin, isBookingUser, isSignedIn } from '../access';

export const Ticket = list({
  description:
    'การจองตั๋ว — สร้าง/แก้ไข/ยกเลิกได้เฉพาะผู้ใช้สถานะ User เท่านั้น (Admin ห้ามจองตั๋ว)',
  access: {
    operation: {
      query: isSignedIn,
      // ✅ กติกาหลักของระบบนี้: Admin ห้ามจอง/แก้ไข/ลบตั๋ว ต้องเป็น User เท่านั้น
      create: isBookingUser,
      update: isBookingUser,
      delete: isBookingUser,
    },
    filter: {
      // Admin อ่านได้ทุกฉบับ (ดูแลระบบ) / User เห็นเฉพาะการจองของตัวเอง
      query: ({ session }) => {
        if (!session) return false;
        if (isAdmin({ session })) return true;
        return { user: { id: { equals: session.itemId } } };
      },
      // User แก้ไข/ยกเลิกได้เฉพาะของตัวเอง (Admin ติด operation ด้านบนอยู่แล้ว)
      update: ({ session }) =>
        isBookingUser({ session }) ? { user: { id: { equals: session.itemId } } } : false,
      delete: ({ session }) =>
        isBookingUser({ session }) ? { user: { id: { equals: session.itemId } } } : false,
    },
  },
  fields: {
    user: relationship({
      ref: 'User.tickets',
      label: 'ผู้จอง',
      // แก้ไขเจ้าของตั๋วหลังสร้างไม่ได้
      access: { update: () => false },
      ui: { displayMode: 'select', hideCreate: true },
    }),
    movie: relationship({
      ref: 'Movie.tickets',
      label: 'ภาพยนตร์',
      access: { update: () => false },
      ui: { displayMode: 'select', hideCreate: true },
    }),
    showtime: relationship({
      ref: 'Showtime.tickets',
      label: 'รอบฉาย',
      access: { update: () => false },
      ui: { displayMode: 'select', hideCreate: true },
    }),
    seats: text({
      label: 'ที่นั่ง (เช่น A5,A6)',
      validation: { isRequired: true, length: { min: 1, max: 100 } },
      access: { update: () => false },
    }),
    status: select({
      type: 'enum',
      label: 'สถานะการจอง',
      options: [
        { label: 'ยืนยันการจอง', value: 'CONFIRMED' },
        { label: 'ยกเลิกการจอง', value: 'CANCELLED' },
      ],
      defaultValue: 'CONFIRMED',
      validation: { isRequired: true },
    }),
    bookedAt: timestamp({
      label: 'วัน-เวลาที่จอง',
      defaultValue: { kind: 'now' },
      validation: { isRequired: true },
      access: { update: () => false },
    }),
  },
  hooks: {
    // ✅ บังคับให้ตั๋วทุกฉบับเป็นของผู้ใช้ที่ล็อกอินอยู่เสมอ
    //    (ผู้ใช้ส่ง user คนอื่นมาก็ถูกแทนที่ด้วย session ของตัวเอง)
    resolveInput: ({ operation, resolvedData, context }) => {
      if (operation !== 'create') return resolvedData;
      const sessionId = context.session?.itemId;
      if (!sessionId) return resolvedData;
      return { ...resolvedData, user: { connect: { id: sessionId } } };
    },
    validate: {
      create: ({ resolvedData, addValidationError }) => {
        if (!resolvedData.movie) addValidationError('ต้องระบุภาพยนตร์ที่ต้องการจอง');
        if (!resolvedData.showtime) addValidationError('ต้องระบุรอบฉายที่ต้องการจอง');
      },
    },
  },
  ui: {
    searchFields: ['seats'],
    listView: { initialSort: { field: 'bookedAt', direction: 'DESC' } },
    // Admin ไม่ควรมีปุ่มสร้างตั๋วใน Admin UI (ระบบจะปฏิเสธอยู่แล้ว)
    hideCreate: ({ session }) => isAdmin({ session }),
  },
});
