import { list } from '@keystone-6/core';
import { integer, relationship, select, text } from '@keystone-6/core/fields';
import { isAdmin } from '../access';

export const Movie = list({
  description: 'ข้อมูลภาพยนตร์ — ทุกคนดูได้ แต่เพิ่ม/แก้ไข/ลบได้เฉพาะ Admin',
  access: {
    operation: {
      // สาธารณะ: ผู้ที่ยังไม่ล็อกอินก็ค้นหาหนังได้
      query: () => true,
      create: isAdmin,
      update: isAdmin,
      delete: isAdmin,
    },
  },
  fields: {
    title: text({
      label: 'ชื่อภาพยนตร์',
      validation: { isRequired: true },
    }),
    synopsis: text({
      label: 'เรื่องย่อ',
      ui: { displayMode: 'textarea' },
    }),
    genre: select({
      type: 'enum',
      label: 'แนวภาพยนตร์',
      options: [
        { label: 'Action', value: 'ACTION' },
        { label: 'Comedy', value: 'COMEDY' },
        { label: 'Drama', value: 'DRAMA' },
        { label: 'Horror', value: 'HORROR' },
        { label: 'Sci-Fi', value: 'SCI_FI' },
        { label: 'Romance', value: 'ROMANCE' },
        { label: 'Animation', value: 'ANIMATION' },
        { label: 'Thriller', value: 'THRILLER' },
      ],
      defaultValue: 'ACTION',
      validation: { isRequired: true },
    }),
    durationInMinutes: integer({
      label: 'ความยาว (นาที)',
      validation: { isRequired: true, min: 1, max: 600 },
    }),
    ageRating: select({
      type: 'enum',
      label: 'เรตติ้ง',
      options: [
        { label: 'ทุกวัย (G)', value: 'G' },
        { label: 'เด็กควรได้รับคำแนะนำ (PG)', value: 'PG' },
        { label: '13 ปีขึ้นไป (PG13)', value: 'PG13' },
        { label: '18 ปีขึ้นไป (R)', value: 'R' },
      ],
      defaultValue: 'PG13',
      validation: { isRequired: true },
    }),
    posterUrl: text({
      label: 'ลิงก์โปสเตอร์ (Poster URL)',
    }),
    showtimes: relationship({
      ref: 'Showtime.movie',
      many: true,
      label: 'รอบฉาย',
      ui: { displayMode: 'count' },
    }),
    tickets: relationship({
      ref: 'Ticket.movie',
      many: true,
      label: 'ตั๋วที่ถูกจอง',
      ui: { displayMode: 'count' },
    }),
  },
  ui: {
    labelField: 'title',
    searchFields: ['title'],
    listView: { initialSort: { field: 'title', direction: 'ASC' } },
    hideCreate: ({ session }) => !isAdmin({ session }),
    hideDelete: ({ session }) => !isAdmin({ session }),
  },
});
