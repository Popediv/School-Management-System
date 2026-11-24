# 🎓 Patimo School Management System (SMS)
### *Next-Generation Cloud ERP & Academic Operating System for Modern Schools*

![License: Proprietary](https://img.shields.io/badge/License-Commercial-blue.svg)
![Version: 2.5.0](https://img.shields.io/badge/Version-2.5.0-success.svg)
![Stack: Node.js | React | Prisma | PostgreSQL](https://img.shields.io/badge/Stack-Node.js%20%7C%20React%20%7C%20PostgreSQL-indigo.svg)

---

## 🌟 Executive Overview

**Patimo SMS** is an enterprise-grade School Management ERP and Academic Information System built specifically for primary, secondary, and K-12 institutions. Designed to eliminate administrative bottlenecks, stop revenue leakages in the bursary, and bridge the communication gap between schools, parents, and students, Patimo SMS delivers a unified digital campus experience.

From **automated Moodle LMS grade synchronisation** and **biometric/QR attendance kiosks** to **automated tuition bill letter generation** and **one-click result publication locks**, Patimo SMS is engineered for institutional scale, security, and effortless daily administration.

---

## 🏢 7 Dedicated Role-Based Portals

Patimo SMS features role-based access control (RBAC) with tailored dashboard experiences for every institutional stakeholder:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PATIMO SMS UNIFIED CLOUD                         │
├───────────────┬────────────────┬────────────────┬──────────────────────┤
│ 👑 Super Admin│ 🎓 Principal   │ 👩‍🏫 Teacher     │ 💼 Bursary / Account │
├───────────────┴────────────────┼────────────────┴──────────────────────┤
│ 👨‍👩‍👧 Parent Portal              │ 🧑‍🎓 Student Portal                    │
└────────────────────────────────┴───────────────────────────────────────┘
```

1. **Super Admin**: Master institutional configuration, Moodle sync management, admission sequence numbering, system audit, and result release controls.
2. **Principal / Vice Principal**: Academic leadership dashboard, class promotion management, cross-department analytics, teacher allocation, and curriculum oversight.
3. **Teacher**: Instant roll call attendance, subject result entry, curriculum Scheme of Work authoring, and student performance tracking.
4. **Bursary / Accounts**: Class-by-class fee structures, individual & bulk billing letters with scholarship/discount toggles, payment recording, and financial ledgers.
5. **Parent**: Real-time attendance monitoring, live fee statements & payment history, official school broadcasts, and academic progress tracking.
6. **Student**: High-resolution passport profile, attendance score, continuous assessment (CA) breakdown, examination scores, class rank, and digital lecture notes.

---

## ⚡ Core Modules & Competitive Advantages

### 1. 🔄 Automated Moodle LMS Grade Synchronisation
- **Seamless Integration**: Connects directly to Moodle REST Web Services using token authentication.
- **Auto-Discovery**: One-click auto-fetch of all Moodle courses and IDs with intelligent subject matching.
- **Many-to-One Mapping**: Easily map multiple class courses (e.g., *Maths JSS1*, *Maths JSS2*) into a single academic subject (*Mathematics*) while maintaining class separation by admission number.
- **Asynchronous Background Processing**: Background job execution with live streaming logs and zero browser timeouts.
- **Automated Rank Recalculation**: Immediately recalculates student positions and subject rankings upon sync completion.

### 2. 📊 Smart Grading, Positions & Result Release Control
- **Dual-Source CA Engine**: Blends raw quiz/test CA scores with live attendance performance (calculated out of 10 points) into a unified Continuous Assessment mark (capped at 40%).
- **Automated WAEC/NECO Standard Grading**: Instant calculation of grades (A, B, C, D, E, F) and pedagogical remarks.
- **Class & Subject Position Tracking**: Tie-aware position calculator generating both subject ranks (`1st`, `2nd`) and overall class rankings (`1st of 28`).
- **Administrative "Release Result" Lock**: Results can be securely uploaded, edited, and previewed by staff while remaining withheld from students and parents until the administrator officially checks **Release Result**.
- **A4 Single-Page Report Card**: Beautiful, print-optimised report sheet featuring school crest watermark, principal & class teacher comments, attendance metrics, and next-term resumption dates.

### 3. 💳 Advanced Bursary, Fee Structures & Bill Letters
- **Dynamic Fee Structures**: Define mandatory fees, one-time development levies, PTA dues, and custom charges per class and term.
- **Parent Bill Letter Engine**: Generate professional fee reminder letters for individual students or entire classes in seconds.
- **Scholarship & Discount Toggles**: Apply percentage discounts or full scholarships on tuition while preserving original invoice auditing.
- **Receipt Generation**: Printable digital payment receipts with unique receipt numbers and automated outstanding balance tracking.

### 4. 📸 Biometrics, QR Kiosks & Smart Attendance
- **Three Ways to Take Attendance**: Manual roll call, QR Code scanning, or DigitalPersona hardware fingerprint biometrics.
- **Attendance-to-Grade Automation**: Classroom presence is converted directly into attendance marks that feed into the student's CA score.
- **Comprehensive Reports**: Daily, weekly, and termly attendance reports filtered by class, gender, and status.

### 5. 🪪 Identity Cards & Official Documents
- **Plastic ID Card Generator**: Front and back dual-sided student identity cards with student passport photo, blood group, emergency contacts, and scannable QR verification code.
- **Bulk PDF Export**: Batch export identity cards and admission letters formatted for instant printing on standard PVC card trays or A4 sheets.
- **Official Admission Letters**: Generate formal letters of admission with school letterhead, admission sequence numbering, and student credentials.

### 6. 📚 Digital Curriculum & Scheme of Work
- **Weekly Scheme of Work**: Week-by-week curriculum planning with learning objectives and pedagogical activities.
- **Curriculum PDF Repository**: Upload complete syllabus textbooks or lesson notes with an integrated, secure in-browser PDF reader (`#toolbar=0`).

---

## 🛠️ Technology Stack

| Layer | Technology | Key Details |
|---|---|---|
| **Frontend** | React 19 + Vite 8 | Ultra-fast HMR, Tailwind CSS v4, Lucide Icons, Recharts |
| **State & Cache** | TanStack Query (React Query) | Real-time optimistic updates and automatic cache invalidation |
| **Backend API** | Node.js + Express | Modular architecture, RESTful endpoints, JWT security |
| **Database** | PostgreSQL (Supabase) | Prisma ORM with connection pooling & transaction isolation |
| **File Storage** | Cloudinary & Local FS | Cloud storage for student passports and school logos |
| **Hardware / IoT** | Web Biometrics SDK | DigitalPersona U.are.U 4500 fingerprint reader integration |

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18.0.0 or higher)
- PostgreSQL database (or Supabase URL)
- npm or pnpm

### 1. Clone the Repository
```bash
git clone https://github.com/your-organization/patimo-sms.git
cd patimo-sms
```

### 2. Configure Backend Server
```bash
cd server
npm install
```

Create a `.env` file in `server/`:
```env
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true&connection_limit=10"
DIRECT_URL="postgresql://user:password@host:5432/postgres?sslmode=require"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="8h"
PORT=5000
NODE_ENV=production
UPLOAD_DIR="uploads"
SCHOOL_NAME="PATIMO COLLEGE"
SCHOOL_CODE="PCI"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

Initialize database migrations:
```bash
npx prisma generate
npx prisma db push
```

Start the backend:
```bash
npm run dev
```

### 3. Configure Frontend Client
In a new terminal window:
```bash
cd client
npm install
```

Create a `.env` file in `client/`:
```env
VITE_API_URL="http://localhost:5000"
```

Start the development server:
```bash
npm run dev
```

Visit `http://localhost:5173` to access the application.

---

## 🔒 Security & Data Integrity

- **Role Guard Middleware**: Every API endpoint is protected by role-checking guards (`SUPER_ADMIN`, `PRINCIPAL`, `TEACHER`, `BURSARY`, `PARENT`, `STUDENT`).
- **Encrypted Password Storage**: Strong one-way password hashing using `bcryptjs`.
- **Database Unique Constraints**: Guarantees that no duplicate admission numbers, student enrollments, or term results can ever occur.
- **Masked Token Security**: Moodle API keys and database credentials are fully masked and never exposed to client browsers.

---

## 📄 License & Commercial Rights

Copyright © 2026 Patimo Technologies. All rights reserved.  
This software and associated documentation files are proprietary and confidential. Unauthorized copying, distribution, modification, or commercial sub-licensing is strictly prohibited. For institutional licensing inquiries, contact **sales@patimocollege.edu.ng**.
