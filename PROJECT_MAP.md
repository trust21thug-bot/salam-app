# PROJECT_MAP — نظام إدارة مدرسة السلام القرآنية

## [TECH_STACK]
- **Framework**: Next.js 16 (App Router, RSC, Turbopack)
- **Language**: TypeScript 5.7+
- **Styling**: Tailwind CSS 4.3.1 + tw-animate-css
- **UI**: shadcn/ui 4.11 (new-york style, Radix primitives)
- **Database**: Supabase (PostgreSQL) + @supabase/supabase-js 2.108.2
- **Charts**: Recharts 3.8.1 (SVG line charts)
- **Image Crop**: react-image-crop 11.0.10
- **PDF**: HTML-to-PDF via browser print (@react-pdf/renderer prepared for future)
- **Forms**: react-hook-form + zod (@hookform/resolvers)
- **Notifications**: sonner (toast)
- **Auth**: None yet (single user; Supabase Auth ready for future)

## [SYSTEM_FLOW]
```
Admin (Rahim) → Dashboard
  ├── Students Management (CRUD + Image crop + Profile/CV)
  ├── Teachers/Circles Management (CRUD teachers, assistants, attendants)
  ├── Attendance (Weekly: select circle→week→day, mass absence, summary table)
  ├── Student Tracking (Weekly: memorization, revision, ward, behavior scores)
  ├── Discipline (Reprimands & praise records per student)
  ├── Ranking (Weekly ranking groups, manual adjustment, general ranking)
  ├── Semester Reports (Grade period selection → PDF)
  └── Settings (Ranking group config, grade thresholds)
```

## [ARCHITECTURE]
```
src/
├── app/(dashboard)/          # Main app pages (RSC default, client islands)
│   ├── page.tsx              # Dashboard with stats
│   ├── students/             # Student CRUD + profile
│   ├── teachers/             # Teacher/Assistant/Attendant CRUD
│   ├── attendance/           # Weekly attendance + summary
│   ├── tracking/             # Weekly memorization/revision tracking
│   ├── discipline/           # Reprimands & praise
│   ├── ranking/              # Weekly/general ranking
│   ├── reports/              # Semester reports + printable docs
│   └── settings/             # Ranking groups + grade thresholds
├── app/api/                  # Route Handlers
│   ├── log/                  # Audit logging endpoint
│   ├── upload/               # Image upload to Supabase Storage
│   └── pdf/                  # PDF generation (CV, semester, ranking)
├── components/
│   ├── ui/                   # shadcn/ui components (button, card, table, etc.)
│   ├── charts/               # Recharts wrappers
│   ├── image-crop/           # react-image-crop wrapper
│   └── pdf/                  # PDF template components
├── lib/
│   ├── supabase/             # DB client (browser/server/admin) + queries
│   ├── formulas/             # All business logic (attendance, grading, ranking, semester)
│   └── utils.ts              # Shared utilities (cn, age calc, labels)
├── types/                    # TS types (database.ts + app.ts)
└── hooks/                    # Custom React hooks
```

### Data Flow Principle
Every data entity is entered ONCE in its source module and consumed automatically by all dependent modules:
- Attendance → Attendance score (formula 6.4) → Ranking (criteria)
- Tracking (memorization/revision) → Grade scores (formula 7.3) → Ranking (criteria)
- Discipline → Student badge counter + CV report
- All → Student CV (section 4.3), Semester report (section 10), Ranking sheet (section 11)

## [ORPHANS & PENDING]
### Currently implemented (M1-M5):
- [x] Next.js project structure + all config files
- [x] DB schema migration (10 tables + indexes + RLS policies)
- [x] Supabase client/server/admin utilities
- [x] All formulas (attendance rate, grading, ranking, semester)
- [x] Logging utility + audit log API
- [x] UI components (button, card, input, select, table, badge, dialog, tabs, textarea, separator, data-table)
- [x] Sidebar navigation
- [x] Dashboard page with stats
- [x] Teachers module (CRUD + assistants + attendants)
- [x] Students module (list + dialog with crop + profile page)
- [x] Attendance module (week/circle/day selection, radio status, mass absence, summary table)
- [x] Tracking module (memorization/revision input with auto grade calculation)
- [x] Discipline module (reprimand/praise recording + log)
- [x] Ranking module (weekly + general tabs, group config)
- [x] Settings module (ranking groups CRUD + grade thresholds)
- [x] Reports module (semester, attendance, ranking tabs)
- [x] Student CV page (profile, chart, discipline log, attendance summary)
- [x] PDF generation routes (CV per student, semester report)
- [x] Image upload API route (Supabase Storage)
- [x] Audit log API route

### Production readiness status:
- [x] Node.js 24.17.0 LTS installed
- [x] `npm install` completed (301 packages)
- [x] TypeScript check — 0 errors
- [x] ESLint — 0 errors (3 warnings, all unused-var with `_` prefix)
- [x] `next build` — compiled successfully, 16 routes
- [x] **Local in-memory DB** (`src/lib/supabase/local.ts`) — يعمل بدون أي خادم خارجي
- [x] **Seed data** — زر في لوحة التحكم يملأ بيانات اختبار (15 طالبًا، 3 أساتذة، حضور، تتبع، توبيخات، ترتيب)
- [x] **Excel import** — زر "استيراد قائمة الطلبة" يقرأ `قائمة الطلبة (2).xlsx` ويستورد 127 طالبًا و 9 حلقات
- [x] **Lazy loading** — ImageCropler يُحمّل عند الحاجة فقط (لا يبطئ التنقل بين الخانات)
- [x] **Trips module** — CRUD + student assignment + PDF/DOCX mission document + try/finally save (دائماً يغلق النافذة ويحدث القائمة)
- [x] **Reception module** — صفحة الاستقبال: جدول التلاميذ الجدد (prospective_students) مع إضافة يدوية، زر إعلام أحمر/أخضر
- [ ] Install Docker Desktop: `winget install Docker.DockerDesktop` (مرة واحدة للتبديل لـ Supabase الحقيقي)
- [ ] Run: `npx supabase start` ثم انسخ المفاتيح إلى `.env.local`
- [ ] Run: `npx supabase db push`

### Future enhancements (not in V1 scope):
- [ ] Multi-user auth (teachers, parents)
- [ ] AI analytics layer (section 12.5)
- [ ] WhatsApp/SMS notifications
- [ ] Mobile native app
