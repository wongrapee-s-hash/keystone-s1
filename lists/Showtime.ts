import { list } from '@keystone-6/core';
import { integer, relationship, text, timestamp } from '@keystone-6/core/fields';
import { isAdmin } from '../access';

export const Showtime = list({
  description: 'รอบฉายภาพยนตร์ (วัน-เวลา / โรง / ราคา) — จัดการได้เฉพาะ Admin',
  access: {
    operation: {
      query: () => true,
      create: isAdmin,
      update: isAdmin,
      delete: isAdmin,
    },
  },
  fields: {
    movie: relationship({
      ref: 'Movie.showtimes',
      label: 'ภาพยนตร์',
      ui: { displayMode: 'select', hideCreate: true },
    }),
    startsAt: timestamp({
      label: 'วัน-เวลาที่ฉาย',
      validation: { isRequired: true },
      defaultValue: { kind: 'now' },
    }),
    hall: text({
      label: 'โรงภาพยนตร์ (เช่น Hall 1)',
      validation: { isRequired: true },
    }),
    price: integer({
      label: 'ราคาตั๋ว (บาท)',
      validation: { isRequired: true, min: 0, max: 10000 },
    }),
    tickets: relationship({
      ref: 'Ticket.showtime',
      many: true,
      label: 'ตั๋วที่ถูกจองในรอบนี้',
      ui: { displayMode: 'count' },
    }),
  },
  hooks: {
    // relationship ไม่มี validation จึงเช็คเอง: รอบฉายต้องมีหนังเสมอ
    validate: {
      create: ({ resolvedData, addValidationError }) => {
        if (!resolvedData.movie) {
          addValidationError('ต้องระบุภาพยนตร์สำหรับรอบฉาย');
        }
      },
    },
  },
  ui: {
    searchFields: ['hall'],
    listView: { initialSort: { field: 'startsAt', direction: 'ASC' } },
    hideCreate: ({ session }) => !isAdmin({ session }),
    hideDelete: ({ session }) => !isAdmin({ session }),
  },
});
