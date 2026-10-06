import { list } from '@keystone-6/core';
import { password, relationship, select, text } from '@keystone-6/core/fields';
import { isAdmin, isSignedIn, ownItemFilter } from '../access';

export const User = list({
  description: 'ผู้ใช้ในระบบ — แบ่งสิทธิ์เป็น Admin (ผู้ดูแล) และ User (ผู้ใช้ทั่วไปที่ใช้จองตั๋ว)',
  access: {
    operation: {
      query: isSignedIn,
      // เฉพาะ Admin เท่านั้นที่เพิ่ม/ลบผู้ใช้ได้
      create: isAdmin,
      update: isSignedIn,
      delete: isAdmin,
    },
    filter: {
      // Admin เห็นผู้ใช้ทุกคน / ผู้ใช้ทั่วไปเห็นเฉพาะตัวเอง
      query: ownItemFilter,
      // Admin แก้ไขได้ทุกคน / ผู้ใช้ทั่วไปแก้ไขได้เฉพาะตัวเอง
      update: ownItemFilter,
    },
  },
  fields: {
    name: text({
      label: 'ชื่อ-นามสกุล',
      validation: { isRequired: true },
    }),
    email: text({
      label: 'อีเมล (ใช้สำหรับล็อกอิน)',
      isIndexed: 'unique',
      validation: { isRequired: true },
    }),
    password: password({
      label: 'รหัสผ่าน',
      validation: { isRequired: true, length: { min: 8 } },
    }),
    role: select({
      type: 'enum',
      label: 'สิทธิ์ผู้ใช้',
      options: [
        { label: 'Admin — ผู้ดูแลระบบ', value: 'Admin' },
        { label: 'User — ผู้ใช้ทั่วไป (ใช้จองตั๋ว)', value: 'User' },
      ],
      defaultValue: 'User',
      validation: { isRequired: true },
      // ป้องกันการยกสิทธิ์ตัวเอง: มีเฉพาะ Admin เท่านั้นที่กำหนด/แก้ไข role ได้
      access: {
        create: isAdmin,
        update: isAdmin,
      },
      ui: {
        createView: { fieldMode: ({ session }) => (isAdmin({ session }) ? 'edit' : 'hidden') },
        itemView: { fieldMode: ({ session }) => (isAdmin({ session }) ? 'edit' : 'hidden') },
      },
    }),
    tickets: relationship({
      ref: 'Ticket.user',
      many: true,
      label: 'การจองตั๋ว',
      // แก้ไขความสัมพันธ์ผ่านด้านนี้ไม่ได้ — ป้องกันการแอบอ้างจองตั๋วของผู้อื่น
      access: {
        update: isAdmin,
      },
      ui: { displayMode: 'count' },
    }),
  },
  ui: {
    labelField: 'name',
    searchFields: ['name', 'email'],
    listView: { initialSort: { field: 'name', direction: 'ASC' } },
    // การเพิ่ม/ลบผู้ใช้เป็นงานของ Admin เท่านั้น
    hideCreate: ({ session }) => !isAdmin({ session }),
    hideDelete: ({ session }) => !isAdmin({ session }),
  },
});
