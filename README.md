# Music Arms LINE Bot Proxy

Vercel Serverless Function ที่ทำหน้าที่เป็น **Webhook Proxy** รับข้อความจาก LINE แล้ว forward ไปยัง Google Apps Script (GAS) เพื่อประมวลผล

## สถาปัตยกรรม

```
LINE Platform → Vercel (Proxy) → Google Apps Script → Google Calendar / Sheets / Gmail
                                        ↓
                                  LINE Reply API
```

### ทำไมต้องมี Proxy?

LINE Webhook ไม่สามารถเรียก Google Apps Script URL (`/exec`) ได้โดยตรง เพราะ GAS จะ redirect (HTTP 302) ซึ่ง LINE Platform ไม่ follow redirect ทำให้ webhook fail

Vercel Proxy จะ:
1. รับ POST จาก LINE Platform
2. Forward ไป GAS พร้อม `redirect: 'follow'`
3. ตอบ LINE กลับ `200 OK` ทันที (ภายใน 1 วินาที)

## โครงสร้างไฟล์

```
line-bot-proxy/
├── api/
│   └── webhook.js      # Serverless function — รับ webhook แล้ว forward ไป GAS
├── package.json
├── vercel.json          # Rewrite rule: ทุก path → /api/webhook
└── README.md
```

## Google Apps Script (Backend)

GAS ทำหน้าที่เป็น backend หลัก จัดการคำสั่งทั้งหมดจาก LINE Bot

### คำสั่งทั้งหมด (v4)

| คำสั่ง | รูปแบบ | คำอธิบาย |
|--------|--------|----------|
| `/ถ่าย` | `/ถ่าย [ชื่องาน] [วัน/เดือน] [M/P]` | เพิ่มงานถ่ายใหม่ → สร้าง Calendar event + เพิ่มแถวใน Sheet |
| `/เสร็จ` | `/เสร็จ [Key] [สถานะ]` | อัพเดทสถานะงาน (ถ่ายจบ, INS เสร็จ, ตัดต่อ, review, publish) |
| `/เช็ค` | `/เช็ค วันนี้` หรือ `/เช็ค สัปดาห์นี้` | ดูตารางงานถ่าย + ลงคลิป จาก Calendar |
| `/สถานะ` | `/สถานะ ทั้งหมด` หรือ `/สถานะ [Key]` | ดูสถานะงานค้างทั้งหมด หรือเฉพาะตัว |
| `/ย้าย` | `/ย้าย [Key] [วัน/เดือน]` | เลื่อนวันถ่าย → ย้าย Calendar event + อัพเดท Sheet |
| `/แก้ชื่อ` | `/แก้ชื่อ [Key] [ชื่อใหม่]` | แก้ไขชื่องานใน Sheet + Calendar |
| `/รายละเอียด` | `/รายละเอียด [Key] [ข้อความ]` | เพิ่ม/แก้ไขรายละเอียดงาน (Notes + Calendar description) |
| `/ลบ` | `/ลบ [Key]` | ลบงานออกจาก Sheet + Calendar |
| `/help` | `/help` หรือ `/คำสั่ง` | แสดงคู่มือคำสั่งทั้งหมด |

### ตัวอย่างการใช้งาน

```
/ถ่าย แกะสูตรพี่แชมป์ 24/3
→ ✅ บันทึกเรียบร้อย! 🎬 M-L-2ddc30 | แกะสูตรพี่แชมป์

/เสร็จ M-L-2ddc30 ถ่ายจบ
→ ✅ อัพเดทแล้ว! 🎬 M-L-2ddc30 | แกะสูตรพี่แชมป์ → Shooting Done

/ย้าย M-L-2ddc30 28/3
→ ✅ ย้ายแล้ว! 📅 24/3 → 28/3

/แก้ชื่อ M-L-2ddc30 รีวิวกีตาร์ Fender
→ ✅ แก้ชื่อแล้ว! 📝 เดิม: แกะสูตรพี่แชมป์ → ใหม่: รีวิวกีตาร์ Fender

/รายละเอียด M-L-2ddc30 เพิ่มฟุตสินค้า 5 ชิ้น
→ ✅ เพิ่มรายละเอียดแล้ว! 📝 เพิ่มฟุตสินค้า 5 ชิ้น

/ลบ M-L-2ddc30
→ 🗑️ ลบแล้ว! 🎬 M-L-2ddc30 | รีวิวกีตาร์ Fender
```

### Key Format

```
[Workstream]-[Type]-[ID]
     M/P      L     6 hex chars

M = Music (🎬)
P = Product (🎹)
L = Live/Production
```

ตัวอย่าง: `M-L-2ddc30`, `P-L-a1b2c3`

### Automated Tasks (GAS Triggers)

| Task | ความถี่ | คำอธิบาย |
|------|---------|----------|
| `sendDailyReport` | ทุกวัน 07:30 | ส่ง email สรุปประจำวัน — งานถ่ายวันนี้/พรุ่งนี้, ลงคลิป, งานค้าง, เตือน overdue |
| `pushDraftToLINE` | ทุก 15 นาที | สแกน Gmail Draft ที่ subject ขึ้นต้น `[LINE Summary]` → ส่งเข้ากลุ่ม LINE แล้วลบ draft |
| `syncCalendarToSheet` | Manual | Sync event จาก Calendar (90 วันย้อนหลัง – 23 วันข้างหน้า) เข้า Sheet |

### Google Sheet Structure (Projects)

| Column | Field | คำอธิบาย |
|--------|-------|----------|
| A | Key | รหัสงาน เช่น M-L-2ddc30 |
| B | Project Name | ชื่องาน |
| C | Workstream | M หรือ P |
| D | Schedule | วันถ่ายตามแผน |
| E | Started | วันเริ่มจริง |
| F | Status | Planned → Shooting Done → Editing → Review → Published |
| G | INS | ✅ เมื่อ INS เสร็จ |
| H | Edit | ✅ เมื่อตัดต่อเสร็จ |
| I | Last Updated | วันที่อัพเดทล่าสุด |
| J | Notes | หมายเหตุ/รายละเอียดเพิ่มเติม |

## การ Deploy

### Vercel Proxy (Repo นี้)

1. Connect repo นี้กับ Vercel
2. Vercel จะ auto-deploy ทุกครั้งที่ push ไป `main`
3. ใช้ Vercel URL เป็น LINE Webhook URL

### Google Apps Script

1. สร้าง Google Apps Script project ใหม่
2. วางโค้ด `gas-final-v4.js` (ไม่ได้อยู่ใน repo นี้)
3. แก้ไข `CONFIG` ให้ตรงกับ LINE Channel Token, Calendar ID, Sheet ID
4. Deploy > New deployment > Web app > Execute as Me
5. คัดลอก URL (`/exec`) ไปใส่ใน `api/webhook.js` บรรทัด `GAS_URL`

### LINE Developers Console

1. ไปที่ LINE Developers Console > Messaging API
2. ตั้ง Webhook URL = Vercel URL ของ repo นี้
3. เปิด "Use webhook"
4. ปิด "Auto-reply messages"

## Version History

| Version | การเปลี่ยนแปลง |
|---------|----------------|
| v1.0 | Initial: /ถ่าย, /เสร็จ, /เช็ค, /สถานะ, /help + Daily Report + Push Draft |
| v2.0 | Add: /ย้าย (move shoot date), syncCalendarToSheet |
| v3.0 | Fix: parseShootCommand, status detection, Calendar color coding |
| v4.0 | Add: /แก้ชื่อ, /รายละเอียด, /ลบ (edit name, edit details, delete project) |

## Tech Stack

- **Proxy:** Vercel Serverless Functions (Node.js)
- **Backend:** Google Apps Script
- **Database:** Google Sheets
- **Calendar:** Google Calendar API (via Apps Script)
- **Email:** Gmail API (via Apps Script)
- **Messaging:** LINE Messaging API (Reply + Push)
