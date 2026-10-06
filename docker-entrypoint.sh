#!/bin/sh
ขั้นตอนเริ่มต้นของ container:
1) รอให้ PostgreSQL พร้อม
2) ตรวจสอบ/สร้างตารางในฐานข้อมูล (prisma db push)
3) เริ่ม KeystoneJS
set -e

echo "[entrypoint] รอ PostgreSQL พร้อมใช้งาน..."
node scripts/wait-for-db.js

echo "[entrypoint] ตรวจสอบ/สร้างตารางในฐานข้อมูล (prisma db push)..."
npx keystone prisma db push --accept-data-loss --skip-generate

echo "[entrypoint] เริ่ม KeystoneJS บนพอร์ต ${PORT:-3000}..."
exec npx keystone start
