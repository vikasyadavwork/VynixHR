export interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  job_title: string;
  employment_type: string;
  status: string;
  location: string;
  join_date: string;
  manager: string;
  avatar_color: string;
}

export interface Directory {
  employees: Employee[];
  departments: string[];
  total: number;
}

export interface Overview {
  metrics: {
    total_employees: number;
    active_employees: number;
    on_leave: number;
    open_positions: number;
    pending_leaves: number;
    attendance_rate: number;
    total_departments: number;
  };
  departments: { name: string; count: number; color: string }[];
  headcount: { month: string; count: number }[];
  recent_hires: Employee[];
  upcoming_events: { title: string; date: string; type: string }[];
  attendance_trend: { day: string; present: number; remote: number; absent: number }[];
}

export interface Leave {
  id: number;
  employee_id: number;
  employee_name: string;
  department: string;
  type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: string;
  created_at: string;
}

export interface AttendanceRow {
  id: number | null;
  employee_id: number;
  employee_name: string;
  department: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  work_mode: string;
  status: string;
  hours: number;
}

export interface AttendanceData {
  attendance: AttendanceRow[];
  summary: { present: number; remote: number; absent: number; on_leave: number; total: number };
  date: string;
}

export interface CurrentUser {
  user: { id: number; name: string; email: string; role: string; employee_id: number | null };
  employee: Employee | null;
}

export interface ChatReply {
  answer: string;
  confidence: number;
  matched: boolean;
  source: { id: string; question: string; category: string } | null;
  suggestions: string[];
}

export interface Job {
  id: number;
  title: string;
  department: string;
  location: string;
  employment_type: string;
  status: string;
  description: string;
  created_at: string;
  applicants_count: number;
}

export interface Applicant {
  id: number;
  job_id: number;
  job_title: string;
  name: string;
  email: string;
  experience_years: number;
  stage: string;
  applied_at: string;
  avatar_color: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  category: string;
  author: string;
  published_at: string;
  pinned: boolean;
}

export interface Settings {
  company_name: string;
  company_email: string;
  location: string;
  work_start: string;
  work_end: string;
  annual_leave_days: number;
  sick_leave_days: number;
  timezone: string;
}
