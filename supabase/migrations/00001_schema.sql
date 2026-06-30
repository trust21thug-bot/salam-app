-- Teachers (Circles are derived 1:1 from teachers)
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  teaching_days INT[] NOT NULL DEFAULT '{}',
  teaching_time TIME NOT NULL DEFAULT '08:00',
  phone TEXT,
  assistant_id UUID,
  required_memorization NUMERIC(4,2) NOT NULL DEFAULT 0.25,
  required_revision NUMERIC(4,2) NOT NULL DEFAULT 0.25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assistant_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  teaching_days INT[] NOT NULL DEFAULT '{}',
  teaching_time TIME NOT NULL DEFAULT '08:00',
  phone TEXT,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE teachers ADD CONSTRAINT fk_assistant FOREIGN KEY (assistant_id) REFERENCES assistant_teachers(id) ON DELETE SET NULL;

CREATE TABLE attendants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  attendant_number TEXT NOT NULL DEFAULT '',
  duty_days INT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Students
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  circle_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  academic_level TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  photo_cropped_url TEXT,
  guardian_phone TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'public_circle' CHECK (classification IN ('invitation', 'project', 'public_circle')),
  illness TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attendance
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused_accepted', 'excused_rejected');

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  day_of_week INT NOT NULL,
  status attendance_status NOT NULL,
  is_mass_absence BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, week_number, day_of_week)
);

-- Weekly Tracking (Memorization & Revision)
CREATE TABLE weekly_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  memorization_amount NUMERIC(4,2) NOT NULL DEFAULT 0,
  revision_amount NUMERIC(4,2) NOT NULL DEFAULT 0,
  ward_score NUMERIC(3,1) NOT NULL DEFAULT 0 CHECK (ward_score >= 0 AND ward_score <= 10),
  behavior_score NUMERIC(3,1) NOT NULL DEFAULT 0 CHECK (behavior_score >= 0 AND behavior_score <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, week_number)
);

-- Discipline (Reprimands & Praise)
CREATE TABLE discipline_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('reprimand', 'praise')),
  reason TEXT NOT NULL,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ranking
CREATE TABLE ranking_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  circle_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE weekly_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  group_id UUID NOT NULL REFERENCES ranking_groups(id) ON DELETE CASCADE,
  memorization_score NUMERIC(3,1) DEFAULT 0,
  revision_score NUMERIC(3,1) DEFAULT 0,
  ward_score NUMERIC(3,1) DEFAULT 0,
  behavior_score NUMERIC(3,1) DEFAULT 0,
  attendance_score NUMERIC(3,1) DEFAULT 0,
  manual_adjustment NUMERIC DEFAULT 0,
  total_score NUMERIC(5,1) GENERATED ALWAYS AS (
    COALESCE(memorization_score,0) * 4 +
    COALESCE(revision_score,0) * 2 +
    COALESCE(ward_score,0) * 2 +
    COALESCE(behavior_score,0) * 1 +
    COALESCE(attendance_score,0) * 1 +
    COALESCE(manual_adjustment,0)
  ) STORED,
  rank_position INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, week_number)
);

CREATE TABLE general_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE UNIQUE,
  total_memorization NUMERIC(5,2) NOT NULL DEFAULT 0,
  master_evaluation NUMERIC(3,1) NOT NULL DEFAULT 0 CHECK (master_evaluation >= 0 AND master_evaluation <= 10),
  total_score NUMERIC(5,1),
  rank_position INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_attendance_circle_week ON attendance_records(circle_id, week_number);
CREATE INDEX idx_attendance_student ON attendance_records(student_id);
CREATE INDEX idx_tracking_student_week ON weekly_tracking(student_id, week_number);
CREATE INDEX idx_discipline_student ON discipline_records(student_id);
CREATE INDEX idx_students_circle ON students(circle_id);
CREATE INDEX idx_weekly_rankings_group_week ON weekly_rankings(group_id, week_number);

-- Enable Row Level Security (for future multi-user support)
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendants ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE discipline_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow all access for now (single user). Secure later when auth is added.
CREATE POLICY "allow_all" ON teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON assistant_teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON attendants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON attendance_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON weekly_tracking FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON discipline_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON ranking_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON weekly_rankings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON general_rankings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
