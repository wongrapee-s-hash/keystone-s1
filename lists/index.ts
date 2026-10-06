import { Movie } from './Movie';
import { Showtime } from './Showtime';
import { Ticket } from './Ticket';
import { User } from './User';

// ไม่ใส่ type annotation 'Lists' เพราะทำให้ list() ติด inferred type ผิดฝั่ง
// keystone.ts รับ lists ผ่าน Record<string, ListConfig<any>> อยู่แล้ว
export const lists = {
  User,
  Movie,
  Showtime,
  Ticket,
};
