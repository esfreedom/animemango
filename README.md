# AnimeHub

เว็บรวมข้อมูลอนิเมะ ตารางฉาย และชุมชนหลายภาษา (TH / EN / JP)
รายละเอียดการออกแบบอยู่ที่ [DESIGN.md](DESIGN.md)

> เว็บนี้ไม่โฮสต์หรือฉายวิดีโอตอนอนิเมะ ลิงก์วิดีโอที่แสดงได้มีเฉพาะ trailer จากช่องทางการที่ตรวจแล้ว และลิงก์ไปยังแพลตฟอร์มที่มีสิทธิ์จริง

## เริ่มต้นใช้งาน (ทดลองในเครื่อง)

ต้องมี Node 24 ขึ้นไป

```bash
npm install
cp .env.example .env.local
```

ตั้งค่าในไฟล์ `.env.local` ให้ใช้ฐานข้อมูลทดลองในเครื่อง:

```
DATABASE_URL=postgresql://postgres@127.0.0.1:5433/postgres
DATABASE_POOL_MAX=1
```

จากนั้นเปิดสองหน้าต่าง

```bash
npm run db:dev
```

```bash
npm run dev
```

ดึงตารางฉายจาก AniList ครั้งแรก (ต้องตั้ง `CRON_SECRET` ใน `.env.local` ก่อน):

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/sync
```

เปิด http://localhost:3000 แล้วระบบจะพาไปหน้าภาษาไทยที่ `/th`

การล็อกอินด้วย Google ต้องตั้งค่า Supabase ก่อน ดูหัวข้อด้านล่าง ถ้ายังไม่ตั้งค่า ปุ่มจะแสดงข้อความว่ายังไม่ได้ตั้งค่า

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | เปิดเซิร์ฟเวอร์พัฒนา |
| `npm run db:dev` | เปิดฐานข้อมูลทดลอง (PGlite) ที่พอร์ต 5433 |
| `npm run db:migrate` | ใช้ migration ทั้งหมดในโฟลเดอร์ `drizzle/` กับ `DATABASE_URL` |
| `npm run db:seed-admin` | สร้างบัญชีแอดมินสำหรับพัฒนา (`admin` / `0000`) ปฏิเสธการทำงานเมื่อ `NODE_ENV=production` |
| `npm run build` | build สำหรับ production (ไม่ต้องมีฐานข้อมูลตอน build) |
| `npm run lint` | ตรวจ ESLint |
| `npm run typecheck` | ตรวจ TypeScript |
| `npm test` | รันเทสด้วย Vitest |
| `npm run db:generate` | สร้าง migration จาก `src/db/schema.ts` |

## โครงสร้างหลัก

```
messages/            ข้อความ UI ทั้ง 3 ภาษา (th คือต้นฉบับ)
src/app/[locale]/    หน้าทั้งหมด แยกตามภาษา
src/app/auth/        callback ของการล็อกอินด้วย Google
src/app/api/cron/    งานตั้งเวลา: sync ตารางฉาย และร่าง AI
src/actions/         server actions (ล็อกอิน ความเห็น โหวต ติดตาม หลังบ้าน)
src/anilist/         client, mapper และ sync จาก AniList
src/ai/              ร่างข้อมูลด้วย AI, validator และคิวตรวจ
src/data/            การอ่านข้อมูล (มี cache และ tag)
src/db/              schema, client ของ Postgres และ PGlite สำหรับเทส
src/lib/session.ts   ผู้ใช้ปัจจุบัน และการสร้างแถวในตาราง users จากโปรไฟล์ Google
src/content/         คู่มือ หน้าทั่วไป และ affiliate
drizzle/             migration ที่ generate แล้ว
scripts/             ฐานข้อมูลทดลอง และตัวรัน migration
```

## ล็อกอินด้วย Google

ระบบไม่มีการกรอกอีเมลหรือรหัสผ่าน ครั้งแรกที่ล็อกอินด้วย Google ระบบจะสร้างบัญชีให้อัตโนมัติ ชื่อและรูปโปรไฟล์จะอัปเดตทุกครั้งที่ล็อกอิน ชื่อผู้ใช้ (username) สร้างจากอีเมลและไม่เปลี่ยนภายหลัง

ตั้งค่าตามลำดับนี้

1. **Google Cloud Console**: สร้างโปรเจกต์ ตั้งค่า OAuth consent screen แล้วสร้าง OAuth client ID ชนิด Web application
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   - คัดลอก Client ID และ Client secret
2. **Supabase > Authentication > Providers > Google**: เปิดใช้งาน แล้ววาง Client ID และ Client secret
3. **Supabase > Authentication > URL Configuration**
   - Site URL: ค่าเดียวกับ `NEXT_PUBLIC_SITE_URL`
   - Redirect URLs: เพิ่ม `http://localhost:3000/auth/callback` และ `https://<โดเมนจริง>/auth/callback`
   - ถ้าใช้หลังบ้าน ให้เพิ่ม `http://admin.localhost:3000/auth/callback` (หรือ `https://<โดเมนหลังบ้าน>/auth/callback`) ด้วย ไม่เช่นนั้นการล็อกอิน Google จากหน้าหลังบ้านจะถูกปฏิเสธ
4. **Supabase > Project Settings > API**: คัดลอก URL และ anon key ใส่ใน `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. รัน migration กับฐานข้อมูล Supabase แล้วรีสตาร์ตเซิร์ฟเวอร์

```bash
DATABASE_URL="<connection string ของ Supabase>" npm run db:migrate
```

หมายเหตุ
- ระหว่างที่ OAuth consent screen ยังอยู่ในโหมด Testing จะล็อกอินได้เฉพาะบัญชีที่เพิ่มเป็น test user
- ระบบยอมรับบัญชี Google ทุกบัญชี ไม่ได้จำกัดเฉพาะ @gmail.com ถ้าต้องการจำกัด ต้องเพิ่มการตรวจอีเมลในโค้ด
- ก่อนเปิดใช้จริง ตรวจปุ่มล็อกอินให้เป็นไปตามแนวทางแบรนด์ของ Google

## ตั้งค่าแอดมิน

ผู้ใช้ใหม่ทุกคนมีบทบาท `user` หากต้องการให้บัญชีเป็นแอดมิน ให้รันคำสั่งนี้ใน SQL editor ของ Supabase โดยใช้ username จากหน้าโปรไฟล์ (`/th/u/<username>`)

```sql
update users set role = 'admin' where username = '<username>';
```

### บัญชีหลังบ้านด้วยรหัสผ่าน (เฉพาะการพัฒนา)

ใช้สำหรับทดลองในเครื่องเท่านั้น หน้า `/login` บนโดเมนหลังบ้านใช้ได้เมื่อไม่ใช่ production หรือกำหนด `ADMIN_PASSWORD_LOGIN=true` อย่างชัดเจนเท่านั้น

1. ตั้ง `ADMIN_SESSION_SECRET` ในไฟล์ `.env.local` อย่างน้อย 32 ตัวอักษร (สร้างด้วย `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`)
2. รัน `npm run db:migrate` แล้ว `npm run db:seed-admin`
3. ตั้ง `ADMIN_SITE_URL=http://admin.localhost:3000` ใน `.env.local` แล้วเปิด http://admin.localhost:3000/login ด้วย `admin` / `0000`

รหัสผ่านเก็บเป็น scrypt hash ไม่เก็บเป็นข้อความ การลองผิดเกิน 5 ครั้งใน 15 นาทีต่อ IP จะถูกบล็อก เซสชันหมดอายุใน 8 ชั่วโมง ก่อนเปิดใช้จริง ต้องปิดบัญชีนี้และใช้ Google เท่านั้น

### หลังบ้านอยู่คนละโดเมน

หลังบ้านเป็นโดเมนย่อยของโค้ดเดียวกัน กำหนดด้วย `ADMIN_SITE_URL` (เช่น `https://admin.example.com`) โค้ดอยู่ใน `src/app/(admin)/` และ `src/proxy.ts` เปิดหน้าเหล่านี้เฉพาะโดเมนหลังบ้าน บนโดเมนหลักเส้นทาง `/admin-app/*` และ `/th/admin/*` จะถูกปฏิเสธหรือย้ายไปโดเมนหลังบ้าน

- ถ้าไม่ตั้ง `ADMIN_SITE_URL` หลังบ้านเข้าไม่ได้ทุกโดเมน
- คุกกี้ของหลังบ้านไม่ถูกส่งไปโดเมนหลัก และคุกกี้ของ Supabase จากการล็อกอิน Google ก็ไม่ถูกส่งไปโดเมนหลังบ้านด้วย (ดู DESIGN.md ส่วนที่ 18)
- การล็อกอิน Google ที่เริ่มจากหน้าหลังบ้านจะกลับมาที่ `/auth/callback` ของโดเมนหลังบ้าน และคุกกี้ของการล็อกอินนั้นอยู่บนโดเมนหลังบ้านเท่านั้น บัญชีต้องมีบทบาท `admin` จึงจะเข้าหน้าหลังบ้านได้

### ค่าย/ผู้เผยแพร่และช่องทางการ

- `/studios` บนโดเมนหลังบ้าน: สร้างโปรไฟล์ค่าย เพิ่มช่องทางการพร้อมลิงก์หลักฐาน แล้วอนุมัติหรือเพิกถอน
- ตัวอย่างวิดีโอจะฝังได้เฉพาะช่องที่แอดมินอนุมัติ และเพิกถอนแล้วหายจากทุกหน้าทันที
- ทุกการอนุมัติหรือเพิกถอนถูกบันทึกใน `audit_log`
- ตัวเลือก "อนุญาตให้ฝังตัวอย่าง" ใช้กับ PV/ตัวอย่างเท่านั้น ไม่ใช่ตอนเต็ม

### การวัดผลและ SEO

- คุกกี้วิเคราะห์ (Google Analytics 4) โหลดหลังผู้ใช้กด "ยอมรับ" เท่านั้น ค่าเริ่มต้นคือ "ไม่ยอมรับ" ตั้งค่า `NEXT_PUBLIC_GA_ID` (รูปแบบ `G-XXXXXXXXXX`)
- Google Search Console: ตั้ง `NEXT_PUBLIC_GSC_VERIFICATION` เป็นค่า content ของ meta tag ที่ GSC ให้มา
- SEO bot: `/api/cron/seo-audit` สุ่มตรวจสูงสุด 100 หน้าจาก sitemap ทุกชั่วโมง ผลดูได้ที่ `/seo` บนโดเมนหลังบ้าน ทดลองด้วย `curl -H "authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/seo-audit?limit=10"`

## ข้อมูลและแหล่งข้อมูล

- **AniList**: เงื่อนไขการใช้งานฟรีเมื่อรายได้ไม่เกิน 150 ดอลลาร์ต่อเดือน เกินนั้นต้องขอสัญญาอนุญาต และห้ามเก็บหรือรวบรวมข้อมูลจำนวนมาก ระบบจึงดึงเฉพาะช่วงตารางฉายรอบวันนี้ (ย้อนหลัง 1 วัน ล่วงหน้า 14 วัน) และไม่เก็บเรื่องย่อของ AniList
- **โปสเตอร์**: โหลดจาก CDN ของ AniList ตาม URL ที่ API ส่งมา ต้องตรวจเงื่อนไขการใช้รูปก่อนใช้เชิงพาณิชย์
- **ร่างกฎหมาย**: หน้า ข้อตกลงการใช้งาน และนโยบายความเป็นส่วนตัวยังเป็นร่าง ต้องให้ที่ปรึกษากฎหมายไทยตรวจก่อนเผยแพร่

## การนำขึ้นใช้งาน

- ฐานข้อมูล: ตั้ง `DATABASE_URL` เป็น Supabase แล้วรัน `npm run db:migrate`
- งานตั้งเวลา: [vercel.json](vercel.json) ตั้งให้ซิงก์ตารางฉายทุกชั่วโมง ร่าง AI ทุกชั่วโมงครึ่ง และ SEO bot ทุกชั่วโมงที่ 15 ต้องตั้ง `CRON_SECRET` ให้ตรงกับที่ Vercel ส่งมา
- ก่อนเปิดใช้จริง: ยังไม่มีตัวแปร `ADMIN_SESSION_SECRET` บน production จะทำให้เข้าหลังบ้านด้วยรหัสผ่านไม่ได้ (ตามที่ตั้งใจ) ใช้ Google แทน และ `NEXT_PUBLIC_GA_ID` ต้องเป็น ID ของเจ้าของบัญชี
- ตัวแปรทั้งหมดอยู่ใน [.env.example](.env.example)

## สถานะการพัฒนา

| เรื่อง | สถานะ |
|---|---|
| แคตตาล็อก หน้าเรื่อง หน้าตอน ค้นหา ฤดูกาล | ใช้งานได้ (ข้อมูลจาก AniList) |
| ตารางฉาย หน้าแรกแบบฟีด เวลาไทย | ใช้งานได้ |
| ดูได้ที่ไหน ประวัติสิทธิ์ ตัวอย่างจากช่องทางการ | ใช้งานได้ ต้องให้แอดมินกรอกข้อมูลที่ตรวจแล้ว |
| ล็อกอินด้วย Google และกระทู้หลายภาษา | โค้ดพร้อม ทดสอบได้เมื่อตั้งค่า Supabase และ Google แล้ว |
| ร่าง AI และคิวตรวจ | ใช้งานได้เมื่อมี `ANTHROPIC_API_KEY` ผู้ตรวจต้องอนุมัติทุกครั้ง |
| โปรไฟล์ ติดตาม โหวต แจ้งเตือน คู่มือ | ใช้งานได้ |
| SEO: sitemap, robots, JSON-LD, hreflang, noindex | ใช้งานได้ |
| Affiliate และโฆษณา | โครงสร้างพร้อม แต่ปิดอยู่ (รายการว่าง และ `NEXT_PUBLIC_ADS_ENABLED=false`) |
| สมาชิกแบบไม่มีโฆษณา | ยังไม่ทำ ต้องมีผู้ให้บริการชำระเงิน |
| การยินยอมคุกกี้ | ยังไม่ทำ ต้องทำก่อนเปิดโฆษณา |


## AI และการเพิ่มสิทธิ์การดู (Proposal)

AI เขียนได้ผ่าน API เดียว และทุกอย่างต้องให้แอดมินอนุมัติ

- `GET /api/ops/snapshot` อ่านรายการเรื่อง เอนทรี และแพลตฟอร์ม
- `POST /api/ops/proposals` ส่ง proposal ชนิด `metadata`, `grouping`, `season_label`, `availability` หรือ `announcement`
- ทั้งสองเส้นต้องมี `Authorization: Bearer <OPS_API_TOKEN>`
- URL ของแหล่งข้อมูลต้องเป็น https และอยู่ใน allowlist (anilist.co, เว็บทางการของแพลตฟอร์มที่มีในตาราง และ `OFFICIAL_SOURCE_HOSTS`)
- ป้าย END/EP คำนวณจากสิทธิ์ที่แอดมินอนุมัติแล้วเท่านั้น

ตัวแปรใหม่ใน `.env.local`:

```
OPS_API_TOKEN=<สุ่มขึ้นมาใหม่>
OFFICIAL_SOURCE_HOSTS=
```

การย้ายข้อมูลครั้งแรก: รัน `npm run db:migrate` ทุกครั้งที่มี migration ใหม่ (0003 คัดลอกข้อมูลจากตารางร่างเดิมไปยัง proposal ส่วน 0004 ลบตารางเดิม)

## ชื่อไทยและการแสดงผลภาษา

- **ชื่อภาษาไทย** แสดงเมื่อมาจากแหล่งทางการที่ตรวจได้ และมีลิงก์กำกับ (ตั้งค่าโดยแอดมินในหน้า `/catalog` หรืออนุมัติ proposal ที่มีลิงก์ทางการ) ระบบไม่รับลิงก์จาก AniList สำหรับชื่อไทย และ AI ไม่สร้างชื่อไทยเอง
- ถ้ายังไม่มีชื่อไทยทางการ หน้าจะแสดงชื่อภาษาอังกฤษพร้อมป้ายบอกว่ายังไม่มีคำแปลไทย
- **ธีม** เลือกได้ที่ส่วนหัวของเว็บ: มืด (ค่าเริ่มต้น), สว่าง หรือตามระบบ ค่าที่เลือกจะถูกจำไว้ในเบราว์เซอร์
- **ภาษา** ของหน้า ประเภท แนว รูปแบบ และเขตเวลาแปลตามภาษาที่เลือก ชื่อเรื่องและเรื่องย่อจากแหล่งภายนอกยังแสดงตามที่มีอยู่
