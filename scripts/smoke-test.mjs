#!/usr/bin/env node
/**
 * ทดสอบระบบจองตั๋วหนังแบบ End-to-End ผ่าน GraphQL API
 * ครอบคลุม: การแบ่งสิทธิ์ Admin/User, การจองตั๋ว,
 *           การยกเลิกตั๋ว, การป้องกัน privilege escalation,
 *           และ Forgot Password ผ่าน Mailpit
 *
 * รัน:   npm run smoke-test          (ต้องเปิดระบบไว้ก่อน)
 * ตัวแปร: APP_URL (default http://localhost:3000)
 *         MAILPIT_URL (default http://localhost:8025)
 */

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const MAILPIT_URL = process.env.MAILPIT_URL || 'http://localhost:8025';
const GQL_URL = `${APP_URL}/api/graphql`;

const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL || 'admin@movieticket.local',
  password: process.env.SEED_ADMIN_PASSWORD || 'Admin@1234',
};
const USER = {
  email: process.env.SEED_USER_EMAIL || 'user@movieticket.local',
  password: process.env.SEED_USER_PASSWORD || 'User@1234',
};

const RUN_STAMP = Date.now();
const SMOKE_EMAIL = `smoketest-${RUN_STAMP}@movieticket.local`;
const SMOKE_OLD_PASSWORD = 'SmokeOld@1234';
const SMOKE_NEW_PASSWORD = 'SmokeNew@1234';
const SMOKE_MOVIE_TITLE = `ภาพยนตร์ทดสอบ-${RUN_STAMP}`;

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } else {
    failed += 1;
    console.log(`  [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function gql(query, variables = {}, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function login(email, password) {
  const json = await gql(
    `mutation ($email: String!, $password: String!) {
      authenticateUserWithPassword(email: $email, password: $password) {
        ... on UserAuthenticationWithPasswordSuccess { sessionToken item { id name role } }
        ... on UserAuthenticationWithPasswordFailure { message }
      }
    }`,
    { email, password }
  );
  const result = json.data?.authenticateUserWithPassword;
  if (result?.sessionToken) return result;
  throw new Error(`ล็อกอินไม่สำเร็จ: ${JSON.stringify(json.errors || result)}`);
}

async function waitFor(url, label, attempts = 120) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // ยังเปิดไม่ได้ — ลองใหม่
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`รอ${label} ไม่สำเร็จ (${attempts} วินาที): ${url}`);
}

async function findResetMail(since) {
  for (let i = 0; i < 20; i += 1) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    if (res.ok) {
      const data = await res.json();
      const messages = (data.messages || [])
        .filter((m) => (m.Subject || '').includes('รีเซ็ตรหัสผ่าน'))
        .filter((m) => Date.parse(m.Created) >= since - 5000)
        .sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created));
      if (messages.length > 0) {
        const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`);
        if (detail.ok) {
          const full = await detail.json();
          const match = (full.Text || '').match(/^Token:\s*(\S+)/m);
          if (match) return { token: match[1], to: messages[0].To };
        }
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function main() {
  console.log('==== ระบบจองตั๋วหนัง — ทดสอบระบบอัตโนมัติ (E2E) ====');
  console.log(`App: ${APP_URL} | Mailpit: ${MAILPIT_URL}\n`);

  console.log('--- 1) ระบบพร้อมใช้งาน ---');
  await waitFor(`${APP_URL}/`, 'Admin UI');
  const ui = await fetch(`${APP_URL}/`);
  check('เปิดหน้า Admin UI ได้ (HTTP 200)', ui.status === 200, `ได้ ${ui.status}`);
  const playground = await fetch(`${GQL_URL}`, { headers: { accept: 'text/html' } });
  check('เปิด GraphQL Playground ได้ (HTTP 200)', playground.status === 200, `ได้ ${playground.status}`);
  await waitFor(`${MAILPIT_URL}/`, 'Mailpit UI', 30);
  check('เปิด Mailpit UI ได้ (http://localhost:8025)', true);

  console.log('\n--- 2) การล็อกอินและสิทธิ์ Admin ---');
  const admin = await login(ADMIN.email, ADMIN.password);
  check('ล็อกอิน Admin สำเร็จ', admin.item.role === 'Admin', `role=${admin.item.role}`);
  const adminToken = admin.sessionToken;

  const createMovie = await gql(
    `mutation {
      createMovie(data: {
        title: "${SMOKE_MOVIE_TITLE}",
        durationInMinutes: 90,
        genre: ACTION,
        ageRating: PG
      }) { id title }
    }`,
    {},
    adminToken
  );
  const smokeMovieId = createMovie.data?.createMovie?.id;
  check('Admin เพิ่มหนังใหม่ได้', Boolean(smokeMovieId), JSON.stringify(createMovie.errors));

  const adminBook = await gql(
    `mutation {
      createTicket(data: {
        movie: { connect: { id: "${smokeMovieId || ''}" } },
        showtime: { connect: { id: "x" } },
        seats: "Z9"
      }) { id }
    }`,
    {},
    adminToken
  );
  check(
    'Admin ถูกห้ามจองตั๋ว (createTicket ต้องล้มเหลว)',
    Boolean(adminBook.errors?.length) && !adminBook.data?.createTicket,
    JSON.stringify(adminBook.errors || adminBook.data)
  );

  const createUser = await gql(
    `mutation {
      createUser(data: {
        name: "ผู้ใช้ทดสอบ",
        email: "${SMOKE_EMAIL}",
        password: "${SMOKE_OLD_PASSWORD}",
        role: User
      }) { id role }
    }`,
    {},
    adminToken
  );
  const smokeUserId = createUser.data?.createUser?.id;
  check('Admin เพิ่มผู้ใช้ใหม่ได้', Boolean(smokeUserId) && createUser.data.createUser.role === 'User',
    JSON.stringify(createUser.errors));

  console.log('\n--- 3) การจองตั๋วของผู้ใช้ (User) ---');
  const smoke = await login(SMOKE_EMAIL, SMOKE_OLD_PASSWORD);
  check('ล็อกอินผู้ใช้ทดสอบสำเร็จ', smoke.item.role === 'User', `role=${smoke.item.role}`);
  const smokeToken = smoke.sessionToken;
  const smokeUserIdFromLogin = smoke.item.id;

  const catalogue = await gql(
    `query {
      movies { id title }
      showtimes { id hall price movie { id } }
    }`,
    {},
    adminToken
  );
  const someMovie = catalogue.data?.movies?.find((m) => m.title !== SMOKE_MOVIE_TITLE) || catalogue.data?.movies?.[0];
  const someShowtime = catalogue.data?.showtimes?.[0];
  check('ดึงรายการหนัง/รอบฉายได้', Boolean(someMovie && someShowtime),
    JSON.stringify(catalogue.errors));

  const book = await gql(
    `mutation ($movieId: ID!, $showtimeId: ID!) {
      createTicket(data: {
        movie: { connect: { id: $movieId } },
        showtime: { connect: { id: $showtimeId } },
        seats: "S1, S2"
      }) { id seats status user { id } }
    }`,
    { movieId: someMovie.id, showtimeId: someShowtime.id },
    smokeToken
  );
  const smokeTicket = book.data?.createTicket;
  check('User จองตั๋วได้', Boolean(smokeTicket), JSON.stringify(book.errors));
  check('ตั๋วที่สร้างเป็นของตัวผู้จองเสมอ (บังคับด้วย resolveInput)',
    smokeTicket?.user?.id === smokeUserIdFromLogin,
    `user=${smokeTicket?.user?.id}`);

  const userBookMovie = await gql(
    `mutation {
      createMovie(data: { title: "ไม่ควรมี-Userเพิ่มหนังไม่ได้", durationInMinutes: 60, genre: DRAMA, ageRating: G }) { id }
    }`,
    {},
    smokeToken
  );
  check('User ถูกห้ามเพิ่มหนัง (createMovie ต้องล้มเหลว)',
    Boolean(userBookMovie.errors?.length) && !userBookMovie.data?.createMovie,
    JSON.stringify(userBookMovie.errors || userBookMovie.data));

  console.log('\n--- 4) การแยกแยะข้อมูลระหว่างผู้ใช้ ---');
  const user = await login(USER.email, USER.password);
  check('ล็อกอิน User (user@movieticket.local) สำเร็จ', user.item.role === 'User');
  const userToken = user.sessionToken;

  const userTickets = await gql(
    `query { tickets { id seats status user { id } } }`,
    {},
    userToken
  );
  const ticketList = userTickets.data?.tickets || [];
  check('User เห็นตั๋วอย่างน้อย 1 ฉบับ (ของตัวเอง)', ticketList.length >= 1,
    `ได้ ${ticketList.length} ฉบับ`);
  check('User ไม่เห็นตั๋วของผู้ใช้อื่น', !ticketList.some((t) => t.id === smokeTicket?.id));
  check('ทุกฉบับที่เห็นเป็นของตัวเอง', ticketList.every((t) => t.user?.id === user.item.id));

  const stealUpdate = await gql(
    `mutation ($id: ID!) {
      updateTicket(where: { id: $id }, data: { status: CANCELLED }) { id status }
    }`,
    { id: smokeTicket?.id || '' },
    userToken
  );
  check('User แก้ไขตั๋วของผู้อื่นไม่ได้',
    Boolean(stealUpdate.errors?.length) || stealUpdate.data?.updateTicket === null,
    JSON.stringify(stealUpdate.errors || stealUpdate.data));

  console.log('\n--- 5) การยกเลิกตั๋วของตัวเอง + ป้องกันยกสิทธิ์ ---');
  const myTicketId = ticketList[0]?.id;
  const cancel = await gql(
    `mutation ($id: ID!) { updateTicket(where: { id: $id }, data: { status: CANCELLED }) { id status } }`,
    { id: myTicketId },
    userToken
  );
  check('User ยกเลิกตั๋วของตัวเองได้', cancel.data?.updateTicket?.status === 'CANCELLED',
    JSON.stringify(cancel.errors || cancel.data));

  const restore = await gql(
    `mutation ($id: ID!) { updateTicket(where: { id: $id }, data: { status: CONFIRMED }) { id status } }`,
    { id: myTicketId },
    userToken
  );
  check('User กู้คืนสถานะตั๋วเป็น CONFIRMED ได้', restore.data?.updateTicket?.status === 'CONFIRMED',
    JSON.stringify(restore.errors || restore.data));

  const escalate = await gql(
    `mutation ($id: ID!) { updateUser(where: { id: $id }, data: { role: Admin }) { id role } }`,
    { id: user.item.id },
    userToken
  );
  check('User ยกสิทธิ์ตัวเองเป็น Admin ไม่ได้',
    escalate.data?.updateUser?.role !== 'Admin',
    JSON.stringify(escalate.errors || escalate.data));

  console.log('\n--- 6) ระบบลืมรหัสผ่าน (Forgot Password) ผ่าน Mailpit ---');
  const sendBefore = Date.now();
  const sendLink = await gql(
    `mutation ($email: String!) { sendUserPasswordResetLink(email: $email) }`,
    { email: SMOKE_EMAIL },
    adminToken
  );
  check('เรียก sendUserPasswordResetLink สำเร็จ', sendLink.data?.sendUserPasswordResetLink === true,
    JSON.stringify(sendLink.errors || sendLink.data));

  const mail = await findResetMail(sendBefore);
  check('อีเมลคืนรหัสผ่านเข้าถึง Mailpit และดึง Token ได้', Boolean(mail?.token),
    'ไม่พบอีเมล/Token ใน Mailpit');
  if (!mail) throw new Error('หยุดทดสอบ: ไม่ได้ Token จาก Mailpit');

  const redeem = await gql(
    `mutation ($email: String!, $token: String!, $password: String!) {
      redeemUserPasswordResetToken(email: $email, token: $token, password: $password) { code message }
    }`,
    { email: SMOKE_EMAIL, token: mail.token, password: SMOKE_NEW_PASSWORD },
    adminToken
  );
  check('แลก Token รีเซ็ตรหัสผ่านสำเร็จ', redeem.data?.redeemUserPasswordResetToken === null,
    JSON.stringify(redeem.errors || redeem.data));

  const newLogin = await login(SMOKE_EMAIL, SMOKE_NEW_PASSWORD);
  check('ล็อกอินด้วยรหัสผ่านใหม่ได้', newLogin.item.role === 'User');

  let oldLoginFailed = false;
  try {
    await login(SMOKE_EMAIL, SMOKE_OLD_PASSWORD);
  } catch {
    oldLoginFailed = true;
  }
  check('ล็อกอินด้วยรหัสผ่านเดิมไม่ได้แล้ว', oldLoginFailed);

  console.log('\n--- 7) เก็บกวาดข้อมูลทดสอบ ---');
  const delTicket = await gql(
    `mutation ($id: ID!) { deleteTicket(where: { id: $id }) { id } }`,
    { id: smokeTicket?.id || '' },
    smokeToken
  );
  check('ผู้ใช้ทดสอบลบตั๋วของตัวเองได้', Boolean(delTicket.data?.deleteTicket), JSON.stringify(delTicket.errors));

  const delMovie = await gql(
    `mutation ($id: ID!) { deleteMovie(where: { id: $id }) { id } }`,
    { id: smokeMovieId || '' },
    adminToken
  );
  check('Admin ลบหนังทดสอบได้', Boolean(delMovie.data?.deleteMovie), JSON.stringify(delMovie.errors));

  const delUser = await gql(
    `mutation ($id: ID!) { deleteUser(where: { id: $id }) { id } }`,
    { id: smokeUserId || '' },
    adminToken
  );
  check('Admin ลบผู้ใช้ทดสอบได้', Boolean(delUser.data?.deleteUser), JSON.stringify(delUser.errors));

  console.log(`\n==== ผลทดสอบ: ผ่าน ${passed} / ไม่ผ่าน ${failed} ====`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('\n[ERROR] ทดสอบหยุดกลางทาง:', error.message || error);
  process.exit(1);
});
