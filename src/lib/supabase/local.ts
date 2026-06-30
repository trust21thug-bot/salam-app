import type { Classification, DisciplineType } from "@/types/database";

type Row = Record<string, unknown>;
type TableName = string;

interface SelectOptions {
  count?: "exact" | "planned" | "estimated";
  head?: boolean;
}

let _dbPath: string | null = null;

function ensureDbPath(): string | null {
  if (_dbPath) return _dbPath;
  if (typeof window !== "undefined") return null;
  try {
    const p = require("path");
    _dbPath = process.env.LOCAL_DB_PATH || p.join(process.cwd(), ".local-db.json");
    return _dbPath;
  } catch {
    return null;
  }
}

export function saveToDisk() {
  const dbPath = ensureDbPath();
  if (!dbPath || !tablesHaveData()) return;
  try {
    const fs = require("fs") as typeof import("fs");
    const p = require("path") as typeof import("path");
    fs.mkdirSync(p.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(getTablesForPersistence()), "utf-8");
  } catch { void 0; }
}

export function tablesHaveData(): boolean {
  for (const key of Object.keys(tables)) {
    if (tables[key].length > 0) return true;
  }
  return false;
}

export function loadFromDisk() {
  const dbPath = ensureDbPath();
  if (!dbPath) return;
  try {
    const fs = require("fs") as typeof import("fs");
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, "utf-8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object" && Object.values(data).some((v: any) => Array.isArray(v) && v.length > 0)) {
        loadTablesFromDisk(data);
      }
    }
  } catch {
    // file may be corrupted or from different version
    try {
      const fs = require("fs") as typeof import("fs");
      const dbPath2 = ensureDbPath();
      if (dbPath2 && fs.existsSync(dbPath2)) fs.unlinkSync(dbPath2);
    } catch { void 0; }
  }
}

const tables: Record<string, Row[]> = {
  teachers: [],
  assistant_teachers: [],
  attendants: [],
  students: [],
  attendance_records: [],
  weekly_tracking: [],
  discipline_records: [],
  ranking_groups: [],
  weekly_rankings: [],
  general_rankings: [],
  prayer_times: [],
  school_year: [],
  trips: [],
  trip_students: [],
  trip_supervisors: [],
  sports_bans: [],
  school_members: [],
  prospective_students: [],
  circle_transfers: [],
};

const UNIQUE_KEYS: Record<string, string[]> = {
  weekly_tracking: ["student_id", "week_number"],
  attendance_records: ["student_id", "week_number", "day_of_week"],
  weekly_rankings: ["student_id", "week_number", "group_id"],
  general_rankings: ["student_id"],
  circle_transfers: ["student_id", "week_number"],
};

export function loadTablesFromDisk(data: Record<string, Row[]>) {
  for (const key of Object.keys(tables)) {
    if (Array.isArray(data[key])) tables[key] = data[key];
  }
}

export function getTablesForPersistence(): Record<string, Row[]> {
  return tables;
}

function genId(): string {
  return crypto.randomUUID();
}

class QueryBuilder {
  private _select: string | undefined;
  private _filters: Array<(r: Row) => boolean> = [];
  private _orderCol: string | undefined;
  private _orderAsc = true;
  private _single = false;
  private _limitVal: number | undefined;
  private _count: boolean = false;
  private _head: boolean = false;
  private _mutatedIds: string[] | null = null;

  constructor(private table: TableName) {}

  private _deleteMode = false;
  private _updateData: Row | null = null;

  select(cols?: string, opts?: SelectOptions) {
    this._select = cols;
    if (opts?.count) this._count = true;
    if (opts?.head) this._head = true;
    return this;
  }

  eq(col: string, val: unknown) {
    this._filters.push((r) => r[col] === val);
    return this;
  }

  in(col: string, vals: unknown[]) {
    const s = new Set(vals);
    this._filters.push((r) => s.has(r[col]));
    return this;
  }

  gte(col: string, val: number | string) {
    this._filters.push((r) => (r[col] as number) >= (val as number));
    return this;
  }

  lte(col: string, val: number | string) {
    this._filters.push((r) => (r[col] as number) <= (val as number));
    return this;
  }

  gt(col: string, val: number | string) {
    this._filters.push((r) => (r[col] as number) > (val as number));
    return this;
  }

  lt(col: string, val: number | string) {
    this._filters.push((r) => (r[col] as number) < (val as number));
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orderCol = col;
    this._orderAsc = opts?.ascending ?? true;
    return this;
  }

  single() {
    this._single = true;
    return this;
  }

  limit(n: number) {
    this._limitVal = n;
    return this;
  }

  private _exec(ids?: string[] | null): Row[] {
    let rows = ids
      ? (tables[this.table] ?? []).filter((r) => ids.includes(r.id as string))
      : (tables[this.table] ?? []);
    for (const f of this._filters) rows = rows.filter(f);
    if (this._orderCol) {
      rows = [...rows].sort((a, b) => {
        const av = a[this._orderCol!];
        const bv = b[this._orderCol!];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "string" && typeof bv === "string")
          return this._orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        return this._orderAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
      });
    }
    if (this._limitVal) rows = rows.slice(0, this._limitVal);
    return rows;
  }

  async then(resolve: (v: { data: unknown; error: null; count?: number | null }) => void) {
    if (this._deleteMode) {
      const toDelete = this._exec();
      const ids = new Set(toDelete.map((r) => r.id));
      tables[this.table] = (tables[this.table] ?? []).filter((r) => !ids.has(r.id));
      saveToDisk();
      this._deleteMode = false;
      resolve({ data: null, error: null });
      return;
    }
    if (this._updateData) {
      const toUpdate = this._exec();
      const data = this._updateData;
      this._updateData = null;
      for (const row of toUpdate) {
        Object.assign(row, data, { updated_at: new Date().toISOString() });
      }
      saveToDisk();
      resolve({ data: null, error: null });
      return;
    }
    if (this._head) {
      const full = (tables[this.table] ?? []).length;
      resolve({ data: null, error: null, count: full });
      return;
    }
    const result = this._exec(this._mutatedIds);
    this._mutatedIds = null;
    resolve({
      data: this._single ? (result[0] ?? null) : result,
      error: null,
      count: this._count ? result.length : undefined,
    });
  }

  upsert(rows: Row | Row[]) {
    const arr = Array.isArray(rows) ? rows : [rows];
    const ids: string[] = [];
    for (const row of arr) {
      const existing = this._exec().find((r) => {
        if (row.id && r.id === row.id) return true;
        const keys = UNIQUE_KEYS[this.table];
        if (keys) return keys.every((key) => r[key] === row[key]);
        return r.id === row.id;
      });
      if (existing) row.id = existing.id;
      if (!row.id) row.id = genId();
      ids.push(row.id as string);
      if (!row.created_at) row.created_at = existing?.created_at ?? new Date().toISOString();
      row.updated_at = new Date().toISOString();
      const idx = (tables[this.table] ?? []).findIndex((r) => r.id === row.id);
      if (idx >= 0) tables[this.table][idx] = { ...tables[this.table][idx], ...row };
      else tables[this.table]?.push(row);
    }
    this._mutatedIds = ids;
    saveToDisk();
    return this;
  }

  insert(rows: Row | Row[]) {
    const arr = Array.isArray(rows) ? rows : [rows];
    const ids: string[] = [];
    for (const row of arr) {
      if (!row.id) row.id = genId();
      ids.push(row.id as string);
      if (!row.created_at) row.created_at = new Date().toISOString();
      row.updated_at = new Date().toISOString();
      tables[this.table]?.push(row);
    }
    this._mutatedIds = ids;
    saveToDisk();
    return this;
  }

  delete() {
    this._deleteMode = true;
    return this;
  }

  update(data: Row) {
    this._updateData = data;
    return this;
  }

  maybeSingle() {
    this._single = true;
    return this;
  }

  clear() {
    tables[this.table] = [];
    saveToDisk();
    return this;
  }
}

export function createLocalClient() {
  return {
    from(table: TableName) {
      if (!tables[table]) tables[table] = [];
      return new QueryBuilder(table);
    },
    storage: {
      from(_bucket: string) {
        return {
          async upload(path: string, file: File | Blob) {
            return { data: { path }, error: null };
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: `/local-storage/${path}` } };
          },
        };
      },
    },
  };
}

export function seedLocalDatabase() {
  const tId1 = crypto.randomUUID();
  const tId2 = crypto.randomUUID();
  const tId3 = crypto.randomUUID();
  const tId4 = crypto.randomUUID();
  const tId5 = crypto.randomUUID();

  const now = new Date().toISOString();

  // Clear all tables
  for (const key of Object.keys(tables)) tables[key] = [];

  // School year start date
  tables.school_year = [
    { id: "current", start_date: "2026-02-07", created_at: now, updated_at: now },
  ];

  // Prayer times
  tables.prayer_times = [
    { id: crypto.randomUUID(), name: "الفجر", sort_order: 1, clock_time: "05:00", created_at: now, updated_at: now },
    { id: crypto.randomUUID(), name: "الظهر", sort_order: 2, clock_time: "12:30", created_at: now, updated_at: now },
    { id: crypto.randomUUID(), name: "العصر", sort_order: 3, clock_time: "15:45", created_at: now, updated_at: now },
    { id: crypto.randomUUID(), name: "المغرب", sort_order: 4, clock_time: "18:00", created_at: now, updated_at: now },
    { id: crypto.randomUUID(), name: "العشاء", sort_order: 5, clock_time: "19:30", created_at: now, updated_at: now },
  ];

  // Same 5 teachers from user data
  const teacherData = [
    { name: "عبد اللطيف قندوزي", phone: "0550123456", days: [0, 3, 4, 5, 6], time: "من الظهر إلى العصر", reqMem: 0.25, reqRev: 0.25 },
    { name: "حمزة سرير", phone: "0550234567", days: [0, 1, 2, 3, 4], time: "من المغرب إلى العشاء", reqMem: 0.5, reqRev: 0.25 },
    { name: "عبد الرحيم عيادي", phone: "0776550582", days: [0, 1, 2, 3, 4], time: "من 19:00 إلى العشاء", reqMem: 0.25, reqRev: 0.5 },
    { name: "أيمن أريج", phone: "0550456789", days: [0, 1, 2, 3, 4], time: "من 10:00 إلى الظهر", reqMem: 0.5, reqRev: 0.25 },
    { name: "عمران صخري", phone: "0550567890", days: [0, 1, 2, 6], time: "من 18:00 إلى العشاء", reqMem: 0.25, reqRev: 0.25 },
  ];
  const tIds = [tId1, tId2, tId3, tId4, tId5];

  tables.teachers = teacherData.map((td, i) => {
    const schedule: Record<string, string> = {};
    for (const d of td.days) schedule[String(d)] = td.time;
    return {
      id: tIds[i], full_name: td.name, phone: td.phone, teaching_days: td.days,
      teaching_time: td.time, required_memorization: td.reqMem, required_revision: td.reqRev,
      assistant_id: null, teaching_schedule: schedule,
      created_at: now, updated_at: now,
    };
  });

  // ~50 students (10 per teacher)
  const firstNames = ["محمد", "أحمد", "عبدالله", "يوسف", "عمر", "خالد", "إبراهيم", "علي", "حسن", "مصطفى",
    "سعيد", "نور", "عمار", "زياد", "بسام", "فهد", "ماجد", "ناصر", "هاني", "وائل",
    "ياسر", "كمال", "جمال", "حامد", "شادي", "رامي", "مروان", "أيمن", "طه", "بكر",
    "الوليد", "معاذ", "زيان", "بدر", "سامي", "رائد", "أمين", "وحيد", "نبيل", "جميل",
    "عبد العزيز", "عبد الكريم", "عبد الحميد", "عبد الرحمن", "عبد الوهاب", "إسماعيل", "إسحاق", "يعقوب", "هارون", "شعيب"];
  const lastNames = ["الزهراني", "القحطاني", "العتيبي", "الغامدي", "الشهري", "المالكي", "العمري", "الجهني", "القرني", "الحارثي",
    "الدوسري", "المطيري", "العنزي", "الشمري", "الهاجري", "الغفيري", "الصبحي", "الحربي", "الزامل", "القادري"];
  const levels = ["1-ابتدائي", "2-ابتدائي", "3-ابتدائي", "4-ابتدائي", "5-ابتدائي", "1-متوسط", "2-متوسط", "3-متوسط", "4-متوسط", "1-ثانوي"];
  const classifications = ["invitation", "project", "public_circle"] as const;
  const fileStatuses = ["complete", "not_paid", "missing_birth_cert", "missing_photo", "missing_photo_and_birth_cert", "no_file"] as const;
  const illnesses = ["ربو", "حساسية", "سكري", null, null, null, null, null, null, null];

  const NUM_STUDENTS = 50;
  tables.students = [];
  for (let i = 0; i < NUM_STUDENTS; i++) {
    const tIdx = i % 5;
    const sid = crypto.randomUUID();
    tables.students.push({
      id: sid,
      first_name: firstNames[i % firstNames.length],
      last_name: lastNames[i % lastNames.length],
      birth_date: `${2010 + Math.floor(i / 10)}-${String((i % 12) + 1).padStart(2, "0")}-${String(10 + (i % 18)).padStart(2, "0")}`,
      guardian_phone: `0550${String(100000 + Math.floor(Math.random() * 900000))}`,
      circle_id: tIds[tIdx],
      classification: classifications[i % 3],
      academic_level: levels[i % 10],
      illness: illnesses[i % 10],
      file_status: fileStatuses[i % 6],
      sibling_ids: [],
      photo_url: null,
      photo_cropped_url: null,
      total_memorization: Math.round(Math.random() * 10 * 10) / 10,
      master_evaluation: Math.round(Math.random() * 100),
      insurance: Math.random() > 0.3,
      created_at: now,
      updated_at: now,
    });
  }

  // Assign siblings
  for (let i = 0; i < tables.students.length; i += 3) {
    if (i + 1 < tables.students.length) {
      tables.students[i].sibling_ids = [tables.students[i + 1].id];
      tables.students[i + 1].sibling_ids = [tables.students[i].id];
    }
  }

  const WEEKS = 19; // Feb 7 to Jun 19 = 19 weeks

  // Generate attendance records for each student on their circle's teaching days
  tables.attendance_records = [];
  for (const s of tables.students) {
    const teacher = tables.teachers.find((t: any) => t.id === s.circle_id) as any;
    const teachingDays: number[] = teacher?.teaching_days ?? [0, 1, 2, 3, 4];
    for (let w = 1; w <= WEEKS; w++) {
      for (const day of teachingDays) {
        tables.attendance_records.push({
          id: crypto.randomUUID(),
          student_id: s.id,
          circle_id: s.circle_id,
          week_number: w,
          day_of_week: day,
          status: (["present", "present", "present", "present", "absent", "late"] as const)[Math.floor(Math.random() * 6)],
          is_mass_absence: false,
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

  // Generate weekly tracking
  tables.weekly_tracking = [];
  for (const s of tables.students) {
    for (let w = 1; w <= WEEKS; w++) {
      tables.weekly_tracking.push({
        id: crypto.randomUUID(),
        student_id: s.id,
        week_number: w,
        memorization_amount: Math.round((Math.random() * 0.8 + 0.2) * 100) / 100,
        revision_amount: Math.round((Math.random() * 0.5 + 0.1) * 100) / 100,
        ward_score: Math.round((Math.random() * 8 + 2) * 10) / 10,
        behavior_score: Math.round((Math.random() * 3 + 7) * 10) / 10,
        total_grade: 0,
        created_at: now,
        updated_at: now,
      });
    }
  }

  // Generate discipline records
  tables.discipline_records = [];
  const reasonsRep = ["تأخير عن الحلقة", "عدم إكمال الواجب", "كلام في غير محله", "عدم احترام النظام", "إزعاج الزملاء"];
  const reasonsPraise = ["اجتهاد في الحفظ", "حسن السلوك", "مساعدة الزملاء", "تفوق في المراجعة", "حضور مبكر"];
  for (let i = 0; i < 30; i++) {
    const sid = tables.students[i % tables.students.length].id;
    tables.discipline_records.push({
      id: crypto.randomUUID(),
      student_id: sid,
      type: (i % 3 === 0 ? "reprimand" : "praise") as DisciplineType,
      reason: i % 3 === 0 ? reasonsRep[i % reasonsRep.length] : reasonsPraise[i % reasonsPraise.length],
      record_date: new Date(Date.now() - i * 86400000 * 3).toISOString(),
      created_at: now,
      updated_at: now,
    });
  }

  // Ranking group
  const gId = crypto.randomUUID();
  tables.ranking_groups = [
    { id: gId, name: "مجموعة الحفظة", circle_ids: [tId1, tId2, tId3, tId4, tId5], created_at: now, updated_at: now },
  ];

  // Weekly rankings
  tables.weekly_rankings = [];
  for (const s of tables.students) {
    for (let w = 1; w <= WEEKS; w++) {
      const ms = Math.round((Math.random() * 3 + 1) * 10) / 10;
      const rs = Math.round((Math.random() * 2 + 0.5) * 10) / 10;
      const ws = Math.round((Math.random() * 2 + 1) * 10) / 10;
      const bs = Math.round((Math.random() * 2 + 6) * 10) / 10;
      const as = Math.round((Math.random() * 2 + 3) * 10) / 10;
      const combined = Math.min(ms + rs, 10);
      const total = combined * 5 + ws * 4 + bs * 2 + as * 3;
      tables.weekly_rankings.push({
        id: crypto.randomUUID(),
        group_id: gId,
        student_id: s.id,
        week_number: w,
        memorization_score: ms,
        revision_score: rs,
        ward_score: ws,
        behavior_score: bs,
        attendance_score: as,
        total_score: Math.round(total * 10) / 10,
        rank_position: 0,
        manual_adjustment: 0,
        created_at: now,
        updated_at: now,
      });
    }
  }

  // Calculate weekly rankings
  for (let w = 1; w <= WEEKS; w++) {
    const wkRankings = tables.weekly_rankings.filter((r: Row) => r.week_number === w);
    wkRankings.sort((a: any, b: any) => (b.total_score || 0) - (a.total_score || 0));
    wkRankings.forEach((r: any, i: number) => { r.rank_position = i + 1; });
  }

  // General rankings
  tables.general_rankings = tables.students.map((s: any) => {
    const studentTracking = tables.weekly_tracking.filter((t: any) => t.student_id === s.id);
    const wkCount = studentTracking.length || 1;
    const avgMem = studentTracking.reduce((sum: number, t: any) => sum + (t.memorization_amount || 0), 0) / wkCount;
    const avgRev = studentTracking.reduce((sum: number, t: any) => sum + (t.revision_amount || 0), 0) / wkCount;
    const avgWard = studentTracking.reduce((sum: number, t: any) => sum + (t.ward_score || 0), 0) / wkCount;
    const avgBeh = studentTracking.reduce((sum: number, t: any) => sum + (t.behavior_score || 0), 0) / wkCount;
    const studentAtt = tables.attendance_records.filter((r: any) => r.student_id === s.id);
    const totalAtt = studentAtt.length;
    const presentCount = studentAtt.filter((r: any) => r.status === "present" || r.status === "excused_accepted").length;
    const attRate = totalAtt > 0 ? (presentCount / totalAtt) * 10 : 0;
    const combined = Math.min(avgMem + avgRev, 10);
    const totalScore = Math.round((combined * 5 + avgWard * 4 + avgBeh * 2 + attRate * 3) * 10) / 10;
    const totalMem = studentTracking.reduce((sum: number, t: any) => sum + (t.memorization_amount || 0), 0);
    return {
      id: crypto.randomUUID(),
      student_id: s.id,
      total_memorization: Math.round(totalMem * 100) / 100,
      master_evaluation: Math.round(avgWard * 10) / 10,
      total_score: totalScore,
      rank_position: 0,
      updated_at: now,
    };
  });
  tables.general_rankings.sort((a: any, b: any) => (b.total_score ?? 0) - (a.total_score ?? 0));
  tables.general_rankings.forEach((r: any, i: number) => { r.rank_position = i + 1; });

  saveToDisk();
  return { teachers: tId1 };
}
