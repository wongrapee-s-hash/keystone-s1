ระบบจองตั๋วหนัง — KeystoneJS (Node.js 22)
FROM node:22-slim

ติดตั้ง openssl ก่อนลง dependencies — ให้ Prisma ตรวจพบ libssl ถูกต้อง
ไม่งั้น Prisma จะเลือก engine ผิดรุ่น (openssl-1.1.x) แล้วใช้การไม่ได้ใน Debian 12
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ติดตั้ง dependencies ก่อน (ใช้ layer cache — แก้โค้ดแล้วไม่ต้องลงใหม่)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

คัดลอกซอร์สโค้ดทั้งหมด (.env / keystone.ts / lists / scripts)
COPY . .

ค่าคอนฟิกสำหรับ build/รันภายใน container
(ค่าจริงตอนรันจะถูก override โดย docker-compose environment)
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=postgresql://movie_user:movie_pass@postgres-db:5432/movie_booking \
    SESSION_SECRET=movie-ticket-booking-secret-key-change-me-1a2b3c4d \
    SMTP_HOST=mailpit \
    SMTP_PORT=1025 \
    NEXT_TELEMETRY_DISABLED=1

build Admin UI + schema artifacts (ต้องทำก่อน keystone start)
RUN npx keystone build

กันปัญหา CRLF (checkout บน Windows ทำให้สคริปต์มี \r แล้ว Linux รันไม่ได้)
RUN sed -i 's/\r$//' docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
