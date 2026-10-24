# AnimeHub

เว็บรวมข้อมูลอนิเมะ ตารางฉาย และชุมชนหลายภาษา (TH / EN / JP)
รายละเอียดการออกแบบทั้งหมดอยู่ที่ [DESIGN.md](DESIGN.md)

> เว็บนี้ไม่โฮสต์หรือฉายวิดีโอตอนอนิเมะ ลิงก์วิดีโอที่แสดงได้มีเฉพาะ trailer จากช่องทางการที่ตรวจแล้ว

## เริ่มต้นใช้งาน

```bash
npm install
cp .env.example .env.local
npm run dev
```

เปิด http://localhost:3000 แล้วระบบจะพาไปหน้าภาษาไทยที่ `/th`

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | เปิดเซิร์ฟเวอร์พัฒนา |
| `npm run build` | build สำหรับ production |
| `npm run lint` | ตรวจ ESLint |
| `npm run typecheck` | ตรวจ TypeScript |
| `npm test` | รันเทสด้วย Vitest |
| `npm run db:generate` | สร้าง migration จาก `src/db/schema.ts` |

## โครงสร้างหลัก

```
messages/            ข้อความ UI ทั้ง 3 ภาษา (th คือต้นฉบับ)
src/i18n/            routing, request config, navigation helpers
src/proxy.ts         proxy ของ next-intl (กำหนดภาษาจาก URL)
src/app/[locale]/    หน้าและ layout ทั้งหมด ต่อภาษา
src/components/      layout และ UI ที่ใช้ร่วมกัน
src/db/schema.ts     schema ของ PostgreSQL (Drizzle)
drizzle/             migration ที่ generate แล้ว
```

## ฐานข้อมูล

ใช้ PostgreSQL (แนะนำ Supabase) ตั้งค่า `DATABASE_URL` ใน `.env.local` แล้วรัน `npm run db:generate` เมื่อแก้ schema
