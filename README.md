# ระบบจองตั๋วหนัง (Movie Ticket Booking)

ระบบจองตั๋วหนังผ่าน API ที่สร้างด้วย **KeystoneJS 7** (GraphQL + Admin UI) บนฐานข้อมูล
**PostgreSQL 14** และรันทั้งหมดด้วย **Docker Compose** — พร้อมระบบยืนยันตัวตน,
การแบ่งสิทธิ์ Admin/User, ระบบลืมรหัสผ่าน (Forgot Password) ผ่าน Mailpit,
และสคริปต์ทดสอบระบบอัตโนมัติแบบ End-to-End

> จุดประสงค์: ส่งเป็นงานวิชา Linux — เน้นการใช้งานจริงผ่าน Docker, การกำหนดค่าผ่าน
> environment, การจัดการสิทธิ์ และการทดสอบระบบ

---

## 1. ภาพรวมสถาปัตยกรรม

```
                        ┌─────────────────────────────────────────────┐
   ผู้ใช้/ผู้ดูแล        │              Docker Compose                │
 ┌──────────────┐       │  network: movie-ticket-booking             │
 │   Browser    │       │                                             │
 │ Admin UI     │──────►│  keystone-app (Node.js 22)                   │
 │ :3000        │  :3000│  ├─ Admin UI (Next.js)                       │
 │              │       │  ├─ GraphQL API  /api/graphql                │
 │ GraphQL      │──────►│  ├─ Auth (session cookie, bcrypt)            │
 │ Playground   │  :3000│  └─ nodemailer ──────┐                       │
 └──────┬───────┘       │                     │ SMTP:1025              │
        │               │  ┌──────────────┐    ▼                       │
        │               │  │ postgres-db  │  ┌──────────────┐          │
        │               │  │ PostgreSQL14 │  │   mailpit    │          │
        │               │  │   :5432      │  │ SMTP :1025   │          │
        │               │  └──────────────┘  │ WebUI :8025   │         │
        │               └────────────────────└──────┬───────┘─────────┘
        │                                            │
        └──────────► http://localhost:8025  (ดูอีเมลจำลอง)
```

| บริการ | พอร์ต (โฮสต์) | หน้าที่ |
|---|---|---|
| `keystone-app` | **3000** | KeystoneJS — Admin UI + GraphQL API |
| `postgres-db` | **5432** | PostgreSQL 14 (เก็บข้อมูลถาวรใน Docker volume) |
| `mailpit` | **8025** / 1025 | Web UI ดูอีเมลจำลอง / พอร์ต SMTP ที่แอปส่งเมลเข้าไป |

> พอร์ตทั้งหมดเปลี่ยนได้ผ่านไฟล์ `.env` (ดูหัวข้อ 7)

---

## 2. เทคโนโลยีที่ใช้

| เทคโนโลยี | รุ่น | ใช้ทำอะไร |
|---|---|---|
| KeystoneJS (`@keystone-6/core`) | 7.0.0 | กรอบงานหลัก — GraphQL schema, Admin UI, access control |
| `@keystone-6/auth` | 9.0.0 | ล็อกอิน/ลืมรหัสผ่าน (bcrypt, password reset token) |
| PostgreSQL | 14-alpine | ฐานข้อมูล |
| Mailpit | ล่าสุด | SMTP จำลอง + เว็บดูอีเมล (ใช้แทน MailHog) |
| Nodemailer | 10.x | ส่งอีเมลจากระบบลืมรหัสผ่าน |
| Docker Compose | v2+ | รันทั้งระบบด้วยคำสั่งเดียว |
| TypeScript | 5.9 | ชนิดข้อมูล compile-time (`npm run typecheck`) |

---

## 3. โครงสร้างไฟล์

```
KeystoneJS-ptro/
├── docker-compose.yml       # นิยาม 3 services: keystone-app, postgres-db, mailpit
├── Dockerfile               # build image: npm ci → keystone build
├── docker-entrypoint.sh     # ตอน container ตื่น: รอ DB → db push → keystone start
├── keystone.ts              # จุดเริ่มต้น: db/session/ui/server config (+ seed)
├── auth.ts                  # ตั้งค่า auth: session, initFirstItem, passwordResetLink
├── access.ts                # ★ นิยาม Session + ฟังก์ชันสิทธิ์ (isAdmin, isBookingUser …)
├── mail.ts                  # ส่งอีเมลรีเซ็ตรหัสผ่านผ่าน SMTP (Mailpit)
├── seed.ts                  # สร้างข้อมูลตัวอย่างอัตโนมัติเมื่อ DB ว่างเปล่า
├── lists/
│   ├── index.ts             # รวม list ทั้ง 4
│   ├── User.ts              # ผู้ใช้ + บทบาท Admin/User
│   ├── Movie.ts             # ภาพยนตร์ (จัดการโดย Admin)
│   ├── Showtime.ts          # รอบฉาย: วัน-เวลา/โรง/ราคา
│   └── Ticket.ts            # ★ การจองตั๋ว — กติกา "Admin ห้ามจองตั๋ว" อยู่ที่นี่
├── scripts/
│   ├── wait-for-db.js       # รอ PostgreSQL พร้อมก่อนเริ่มแอป (ใน container)
│   └── smoke-test.mjs       # ★ ทดสอบ E2E 28 รายการ (สิทธิ์ + forgot password)
├── .env / .env.example      # ค่า environment (พอร์ต, DB, SMTP, secret, ผู้ใช้ seed)
├── package.json             # npm scripts: dev, build, start, typecheck, smoke-test
├── .gitattributes           # บังคับ LF ให้ไฟล์ .sh (กัน CRLF จาก Windows)
├── .dockerignore / .gitignore
└── README.md                # เอกสารนี้
```

---

## 4. การติดตั้งและรัน (วิธีหลัก — Docker)

**ข้อกำหนด:** ติดตั้ง [Docker Desktop](https://www.docker.com/products/docker-desktop/) แล้วเปิดทิ้งไว้

```bash
# 1) build image และเปิดทั้ง 3 บริการ
docker compose up -d

# 2) รอสักครู่ (ครั้งแรก build อาจใช้เวลา 3-5 นาที) แล้วตรวจสถานะ
docker compose ps

# 3) ดู log แอป (ควรเห็น "[seed] สร้างข้อมูลตัวอย่างเรียบร้อยแล้ว")
docker compose logs -f keystone-app
```

เปิดใช้งาน:

| ลิงก์ | สิ่งที่ได้ |
|---|---|
| http://localhost:3000 | Admin UI (ต้องล็อกอิน) |
| http://localhost:3000/api/graphql | GraphQL Playground (กด GET แล้วเลือก Header `Accept: text/html`) |
| http://localhost:8025 | Mailpit — กล่องจดหมายจำลอง (ดูอีเมลรีเซ็ตรหัสผ่าน) |

**บัญชีผู้ใช้ตั้งต้น (สร้างอัตโนมัติโดย `seed.ts`):**

| บทบาท | อีเมล | รหัสผ่าน | ทำอะไรได้บ้าง |
|---|---|---|---|
| **Admin** | `admin@movieticket.local` | `Admin@1234` | จัดการหนัง/รอบฉาย/ผู้ใช้, ดูตั๋วทุกฉบับ — **ห้ามจองตั๋ว** |
| **User** | `user@movieticket.local` | `User@1234` | จอง/ยกเลิกตั๋วของตัวเองเท่านั้น |

ข้อมูลตั้งต้นอื่น ๆ: ภาพยนตร์ 3 เรื่อง (Interstellar, Titanic, The Dark Knight),
รอบฉาย 5 รอบ และตั๋วตัวอย่าง 1 ฉบับ (ของ User)

**คำสั่งปิด/รีเซ็ต:**

```bash
docker compose down        # ปิดบริการ (ข้อมูลใน DB คงอยู่)
docker compose down -v     # ปิด + ลบ volume (ข้อมูลหาย — คราวหน้าจะ seed ใหม่)
docker compose logs        # ดู log ทั้งหมด
docker compose up -d --build   # build ใหม่เมื่อแก้โค้ด
```

---

## 5. การแบ่งสิทธิ์ (Access Control) — หัวใจของระบบ

กำหนดไว้ใน `access.ts` + `lists/*.ts` ของ list แต่ละตัว:

### 5.1 ตารางสิทธิ์

| การดำเนินการ | Admin | User | ยังไม่ล็อกอิน |
|---|:---:|:---:|:---:|
| ดูรายการหนัง / รอบฉาย | ✅ | ✅ | ✅ |
| เพิ่ม/แก้ไข/ลบ หนังและรอบฉาย | ✅ | ❌ | ❌ |
| ดูรายการผู้ใช้ | ✅ (ทุกคน) | ✅ (เฉพาะตัวเอง) | ❌ |
| เพิ่ม/ลบ ผู้ใช้, กำหนด role | ✅ | ❌ | ❌ |
| **จองตั๋ว (createTicket)** | ❌ | ✅ | ❌ |
| **แก้ไข/ยกเลิกตั๋ว** | ❌ | ✅ (เฉพาะของตัวเอง) | ❌ |
| ดูตั๋ว | ✅ (ทุกฉบับ) | ✅ (เฉพาะของตัวเอง) | ❌ |

### 5.2 จุดสำคัญที่ต้องอธิบายอาจารย์

1. **"Admin ห้ามจองตั๋ว"** — ที่ `lists/Ticket.ts` กำหนด
   `create/update/delete: isBookingUser` โดย `isBookingUser` (ใน `access.ts`)
   จะคืน `true` ก็ต่อเมื่อ `session.data.role === 'User'` เท่านั้น
   → แม้ล็อกอินเป็น Admin แล้วเรียก `createTicket` จะได้ GraphQL error ทันที

2. **กันยกสิทธิ์ตัวเอง (privilege escalation)** — field `role` ใน `User.ts`
   กำหนด `access: { create: isAdmin, update: isAdmin }`
   → ผู้ใช้ทั่วไปรัน `updateUser(data: { role: Admin })` กับตัวเองไม่ได้

3. **บังคับเจ้าของตั๋ว** — hook `resolveInput` ใน `Ticket.ts` จะเขียนทับ
   `user` ของตั๋วทุกฉบับให้เป็น `session.itemId` ของผู้เรียกเสมอ
   → ส่ง `user` ของคนอื่นมาก็ไร้ผล

4. **กรองข้อมูลรายคน (filter access)** — `Ticket.filter.query` ให้ Admin เห็นทุกฉบับ
   แต่ User เห็นเฉพาะ `{ user: { id: session.itemId } }`
   → query `tickets` ของ User จึงคืนเฉพาะของตัวเอง

5. **ฟิลด์ที่แก้ไขไม่ได้หลังสร้าง** — `user`, `movie`, `showtime`, `seats`, `bookedAt`
   กำหนด `access: { update: () => false }` → หลังจองแล้วแก้ไขได้เฉพาะ `status`
   (ใช้สำหรับยกเลิกการจองเท่านั้น)

---

## 6. ทดสอบระบบอัตโนมัติ (E2E)

เมื่อระบบทำงานอยู่ (`docker compose up -d` เสร็จแล้ว):

```bash
npm install        # ครั้งแรกครั้งเดียว (ใช้ Node 22+)
npm run smoke-test
```

สคริปต์ `scripts/smoke-test.mjs` จะทดสอบ **28 รายการ** ครอบคลุม:

- เปิด Admin UI / GraphQL Playground / Mailpit ได้
- ล็อกอิน Admin สำเร็จ และ **Admin ถูกห้ามจองตั๋ว**
- User จองตั๋วได้ และตั๋วถูกบังคับเป็นของตัวเองเสมอ
- User ถูกห้ามเพิ่มหนัง / แก้ไขตั๋วคนอื่น / ยกสิทธิ์ตัวเองเป็น Admin
- User เห็นเฉพาะตั๋วของตัวเอง, ยกเลิก-กู้คืนตั๋วของตัวเองได้
- **Forgot Password ครบวงจร**: ส่งลิงก์ → ดึง Token จาก Mailpit → แลก Token →
  ล็อกอินด้วยรหัสใหม่ได้ / รหัสเก่าใช้ไม่ได้
- เก็บกวาดข้อมูลทดสอบทั้งหมดตอนจบ (ระบบกลับสภาพเดิมพอดี)

ผลการทดสอบล่าสุด: **ผ่าน 28 / ไม่ผ่าน 0** (ทั้งบน `npm run dev` และ Docker เต็มระบบ)

---

## 7. ระบบลืมรหัสผ่าน (Forgot Password) ผ่าน Mailpit — ทดลองด้วยมือ

1. เปิด GraphQL Playground ที่ http://localhost:3000/api/graphql
   (ถ้าหน้าว่าง ให้กดแท็บ Network → เพิ่ม Header `Accept: text/html` แล้วรีเฟรช)

2. รันคำสั่งขอรีเซ็ตรหัสผ่าน (ใส่อีเมลที่มีในระบบ):

   ```graphql
   mutation {
     sendUserPasswordResetLink(email: "user@movieticket.local")
   }
   ```

   > ค่าที่คืนเป็น `true` เสมอ ไม่ว่าอีเมลจะมีในระบบหรือไม่
   > (กันไม่ให้คนนอกเดาได้ว่าอีเมลไหนลงทะเบียนแล้ว)

3. เปิด **Mailpit** ที่ http://localhost:8025 → จะเห็นอีเมล
   `[Movie Ticket Booking] รหัสสำหรับรีเซ็ตรหัสผ่านของคุณ`
   → เปิดอีเมลแล้วก็อปค่า **Token** (อายุ 30 นาที ใช้ได้ 1 ครั้ง)

4. แลก Token เพื่อตั้งรหัสผ่านใหม่ (แทนที่ `<TOKEN>` และ `<รหัสผ่านใหม่>`):

   ```graphql
   mutation {
     redeemUserPasswordResetToken(
       email: "user@movieticket.local"
       token: "<TOKEN>"
       password: "<รหัสผ่านใหม่>"
     ) {
       code
       message
     }
   }
   ```

   ค่าที่ได้ `null` = สำเร็จ

5. ล็อกอินด้วยรหัสผ่านใหม่ได้ทันที — รหัสเก่าใช้ไม่ได้อีก

**ตัวอย่าง mutation อื่น ๆ ที่ควรลอง:**

```graphql
# ล็อกอิน (ดูว่า role ถูกต้อง)
mutation {
  authenticateUserWithPassword(email: "admin@movieticket.local", password: "Admin@1234") {
    ... on UserAuthenticationWithPasswordSuccess { sessionToken item { id name role } }
    ... on UserAuthenticationWithPasswordFailure { message }
  }
}

# Admin เพิ่มหนัง
mutation {
  createMovie(data: { title: "Avengers Endgame", durationInMinutes: 181, genre: ACTION, ageRating: PG13 }) {
    id title
  }
}

# User จองตั๋ว (แทนที่ ID ด้วยค่าจริงจาก query showtimes)
mutation {
  createTicket(data: {
    movie: { connect: { id: "<movie-id>" } }
    showtime: { connect: { id: "<showtime-id>" } }
    seats: "C1, C2"
  }) { id seats status user { name } }
}

# Admin เรียก createTicket → จะได้ error "ไม่ได้รับอนุญาต" (กติกาในหัวข้อ 5)
```

---

## 8. รัน Keystone บนเครื่องตรง (ไม่ผ่าน Docker app — ทางเลือก)

ใช้ตอน development เดบักโค้ดเร็วขึ้น โดยให้ DB + Mailpit รันใน Docker แทน:

```bash
# เปิดเฉพาะฐานข้อมูลและ Mailpit
docker compose up -d postgres-db mailpit

# ติดตั้ง dependencies แล้วรันโหมด dev (auto db push + hot reload)
npm install
npm run dev
```

ค่าใน `.env` ถูกตั้งให้ชี้ `localhost` อยู่แล้วสำหรับวิธีนี้
(ภายใน Docker container compose จะ override ให้ชี้ `postgres-db` / `mailpit` แทน)

คำสั่งอื่น ๆ:

```bash
npm run typecheck   # ตรวจ types ด้วย TypeScript
npm run db:push     # sync schema กับฐานข้อมูลด้วยมือ
npm run build       # build Admin UI (ต้องทำก่อน npm run start)
npm run start       # รัน production (ต้อง build ก่อน)
```

---

## 9. ปัญหาที่พบบ่อย (Troubleshooting)

| อาการ | วิธีแก้ |
|---|---|
| `port is already in use` | พอร์ต 3000/5432/8025 ถูกใช้อยู่ — เปลี่ยนใน `.env` แล้ว `docker compose up -d` ใหม่ |
| อยากเริ่มข้อมูลใหม่หมด | `docker compose down -v && docker compose up -d` |
| เปลี่ยนโค้ดแล้วอยากให้ Docker เห็น | `docker compose up -d --build` |
| ดูว่าแอป error อะไร | `docker compose logs -f keystone-app` |
| ลืมรหัสผ่านแต่ไม่เห็นอีเมล | เช็กว่า `mailpit` ขึ้นสถานะ healthy (`docker compose ps`) และเปิด http://localhost:8025 |
| Windows: สคริปต์ `.sh` รันไม่ได้ | สาเหตุจาก CRLF — โปรเจกต์มี `.gitattributes` บังคับ LF แล้ว และ Dockerfile มี `sed` แก้อีกชั้น |
| ครั้งแรก `docker compose up` ช้ามาก | กำลัง build image (npm ci + Next.js build) — รอจน `Server listening on :3000` |

---

## 10. แผนการทำงานกลุ่ม 3 คน (Git Workflow)

### 10.1 การแบ่งงาน (ใครนำไฟล์ไหนไป Commit บ้าง)

| สมาชิก | รับผิดชอบนำไฟล์เหล่านี้ไป Commit | งานหลัก |
|---|---|---|
| **คนที่ 1 — Backend/Keystone** | `keystone.ts`, `auth.ts`, `access.ts`, `mail.ts`, `seed.ts`, `lists/index.ts`, `lists/User.ts`, `lists/Movie.ts`, `lists/Showtime.ts`, `lists/Ticket.ts` | Schema, access control, hook, auth, seed |
| **คนที่ 2 — DevOps/Config** | `package.json`, `tsconfig.json`, `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `.env`, `.env.example`, `.gitignore`, `.dockerignore`, `.gitattributes`, `scripts/wait-for-db.js` | Docker, environment, build, โครงสร้างโปรเจกต์ |
| **คนที่ 3 — QA & Docs** | `scripts/smoke-test.mjs`, `README.md` | ทดสอบ E2E, เอกสารภาษาไทย |

> หลักการ: คนละไฟล์กันให้มากที่สุด เพื่อลด conflict — ถ้าจำเป็นต้องแก้ไฟล์เดียวกัน
> ให้คุยกันก่อนแล้วรวมทาง `git merge` (เช่น คน 1 แก้ `lists/*` ให้คน 3 รู้ก่อนรัน test)

**เช็กความครบถ้วนหลังทุกคน commit:** สมาชิก 3 คนรวมกันต้องมีครบทุกไฟล์ในหัวข้อ 3 —
ถ้าไฟล์ไหนหาย ให้เปิด issue หรือแจ้งในกลุ่มทันที

### 10.2 ขั้นตอนเริ่มต้น (ครั้งแรก — ให้ "คนที่ 1" เป็นคนสร้าง repo)

```bash
# คนที่ 1: สร้าง repo แล้ว push ไฟล์ของตัวเองก่อน
git init
git checkout -b main
git add <ไฟล์ของคนที่ 1>              # อย่าเพิ่ง git add . ถ้ายังไม่ครบ
git commit -m "feat: Keystone lists + access control + seed"
git remote add origin <URL ของ repo>
git push -u origin main

# คนที่ 2 และคนที่ 3: clone แล้วเพิ่มไฟล์ของตัวเอง
git clone <URL ของ repo>
git checkout -b feat/<ชื่อ-งาน>
git add <ไฟล์ของตัวเอง>
git commit -m "feat: Docker Compose + scripts"
git push -u origin feat/<ชื่อ-งาน>
```

> วิธีที่ง่ายกว่า (ถ้าทุกคนมีสิทธิ์เข้าถึง repo เดียวกัน):
> คนที่ 1 `git init` + สร้าง repo ว่างบน GitHub → ทุกคน clone → แล้วค่อยแบ่ง commit
> ตามตารางใครเอาไฟล์ไหนในหัวข้อ 10.1

### 10.3 วงจรการทำงานต่อวัน

```bash
git pull origin main              # ดึงงานล่าสุดก่อนเริ่มเสมอ
git checkout -b feat/ชื่อ-งาน     # แยก branch ของตัวเอง
... แก้โค้ด + รัน npm run typecheck / smoke-test ...
git add <ไฟล์ที่แก้ (ของตัวเองตามหัวข้อ 10.1)>
git commit -m "feat: เพิ่มระบบยกเลิกตั๋ว"
git push -u origin feat/ชื่อ-งาน
# เปิด Pull Request ให้สมาชิกอีก 2 คน review แล้ว merge
```

**รูปแบบ commit message:** `feat:` (เพิ่มของใหม่), `fix:` (แก้บั๊ก),
`docs:` (เอกสาร), `test:` (เพิ่ม/แก้ test), `chore:` (งานจุกจิก)

**ตัวอย่างลำดับ commit ที่แนะนำ (เทียบกับงานที่ส่ง):**

| ครั้งที่ | Commit | เจ้าของ |
|---|---|---|
| 1 | `feat: scaffold โปรเจกต์ + Keystone lists ทั้ง 4` | คนที่ 1 |
| 2 | `feat: access control การแบ่งสิทธิ์ Admin/User` | คนที่ 1 |
| 3 | `feat: Docker Compose (keystone + postgres + mailpit)` | คนที่ 2 |
| 4 | `feat: environment config + wait-for-db` | คนที่ 2 |
| 5 | `feat: ระบบ forgot password ผ่าน Mailpit` | คนที่ 1 |
| 6 | `test: smoke-test E2E 28 รายการ` | คนที่ 3 |
| 7 | `docs: README ภาษาไทย + แผนการทำงานกลุ่ม 3 คน` | คนที่ 3 |

### 10.4 เช็กงานก่อนปิดรอบ (Definition of Done)

- [ ] `npm run typecheck` ผ่าน
- [ ] `docker compose down -v && docker compose up -d` รันใหม่ได้จากศูนย์
- [ ] `npm run smoke-test` ผ่าน 28/28
- [ ] commit ทุกอันมี prefix ตามรูปแบบ และ merge ผ่าน PR

---

## 11. หมายเหตุทางเทคนิค

- **.session** เป็น stateless session (เข้ารหัสใน cookie ด้วย `SESSION_SECRET`
  ความยาว ≥ 32 ตัวอักษร) — ค่าตั้งไว้ใน `.env`
- **`secure: false`** ตั้งไว้ใน `auth.ts` เพราะระบบเดโมรันผ่าน HTTP (localhost)
  ถ้าเป็น `true` เบราว์เซอร์จะไม่เก็บ cookie → เข้าสู่ระบบไม่ได้
- **schema sync** ใน container ใช้ `prisma db push` (เหมาะกับโปรเจกต์เดโม)
  ไม่ได้ใช้ migration ไฟล์ — ถ้าต้องการ migration ใช้ `npx keystone migrate`
- **`docker-entrypoint.sh`** รอ PostgreSQL พร้อม (`scripts/wait-for-db.js`)
  แล้วค่อย sync schema และเริ่มแอป — กัน race condition ตอน `compose up`
- **Dockerfile ติดตั้ง `openssl`** ก่อน `npm ci` เพื่อให้ Prisma เลือก engine
  ตรงรุ่นกับ Debian 12 (ไม่งั้น `prisma db push` จะล้มเหลว)
- **`seed.ts`** ทำงานผ่าน `db.onConnect` — รันก็ต่อเมื่อตาราง `User` ยังว่างเปล่า
  (idempotent — รีสตาร์ทกี่ครั้งก็ไม่ทับข้อมูลเดิม)

## 12. แหล่งอ้างอิง

- KeystoneJS 6/7: https://keystonejs.com/docs
- Keystone รุ่นที่ใช้: `@keystone-6/core@7.0.0`, `@keystone-6/auth@9.0.0`
- Docker Compose: https://docs.docker.com/compose/
- Mailpit: https://github.com/axllent/mailpit
- Prisma (db push): https://www.prisma.io/docs/orm/prisma-cli
