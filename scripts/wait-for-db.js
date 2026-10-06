#!/usr/bin/env node
/**
 
รอให้ PostgreSQL พร้อมรับการเชื่อมต่อ (ใช้โดย docker-entrypoint.sh)
อ่าน host/port จาก DATABASE_URL — ลองต่อทุก 1 วินาที สูงสุด 60 ครั้ง*/
const net = require('node:net');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[wait-for-db] ยังไม่ได้ตั้งค่า DATABASE_URL');
  process.exit(1);
}

const parsed = new URL(url);
const host = parsed.hostname  'localhost';
const port = Number(parsed.port 
 5432);
const maxAttempts = 60;
let attempt = 0;

function tryConnect() {
  attempt += 1;
  const socket = net.connect({ host, port }, () => {
    socket.end();
    console.log([wait-for-db] PostgreSQL พร้อมแล้วที่ ${host}:${port} (ตรวจพบครั้งที่ ${attempt}));
    process.exit(0);
  });
  socket.on('error', () => {
    socket.destroy();
    if (attempt >= maxAttempts) {
      console.error([wait-for-db] รอครบ ${maxAttempts} ครั้ง ยังเชื่อมต่อ ${host}:${port} ไม่ได้);
      process.exit(1);
    }
    console.log([wait-for-db] ยังเชื่อมต่อ ${host}:${port} ไม่ได้ — ลองใหม่ใน 1 วินาที (${attempt}/${maxAttempts}));
    setTimeout(tryConnect, 1000);
  });
}

tryConnect();
