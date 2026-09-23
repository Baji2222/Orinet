-- HR Portal - Supabase schema
--
-- This was missing from the original repo even though every backend route
-- already queries these tables. Run this once in your Supabase project
-- (SQL Editor > New query) before starting the backend.
--
-- The backend connects with the SECRET key (full access, bypasses RLS),
-- so Row Level Security can stay enabled with no policies - the API server
-- is the only thing that ever talks to these tables directly.

-- =====================================================================
-- USERS
-- =====================================================================
create table if not exists public.users (
  id               bigint generated always as identity primary key,
  name             text not null,
  email            text not null unique,
  password_hash    text not null,
  employee_code    text not null unique,
  department       text default '',
  designation      text default '',
  date_of_joining  date,
  role             text not null default 'employee' check (role in ('employee', 'admin')),
  net_salary       numeric,
  created_at       timestamptz not null default now()
);

-- =====================================================================
-- ATTENDANCE
-- =====================================================================
create table if not exists public.attendance (
  id          bigint generated always as identity primary key,
  user_id     bigint not null references public.users(id) on delete cascade,
  date        date not null,
  check_in    timestamptz,
  check_out   timestamptz,
  status      text default 'present',
  notes       text default '',
  created_at  timestamptz not null default now(),
  unique (user_id, date)
);

-- =====================================================================
-- LEAVE REQUESTS
-- =====================================================================
create table if not exists public.leave_requests (
  id             bigint generated always as identity primary key,
  user_id        bigint not null references public.users(id) on delete cascade,
  from_date      date not null,
  to_date        date not null,
  type           text default '',
  reason         text default '',
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_comment  text default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- =====================================================================
-- PAYSLIPS (metadata only - files live in the "payslips" storage bucket)
-- =====================================================================
create table if not exists public.payslips (
  id             bigint generated always as identity primary key,
  user_id        bigint not null references public.users(id) on delete cascade,
  month          text not null,
  year           integer not null,
  file_name      text not null,
  original_name  text not null,
  storage_path   text not null,
  uploaded_at    timestamptz not null default now()
);

-- =====================================================================
-- GENERIC HR REQUESTS
-- =====================================================================
create table if not exists public.requests (
  id             bigint generated always as identity primary key,
  user_id        bigint not null references public.users(id) on delete cascade,
  type           text default '',
  subject        text not null,
  message        text not null,
  status         text not null default 'open' check (status in ('open', 'resolved')),
  admin_comment  text default '',
  admin_reply    text default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- =====================================================================
-- HOLIDAYS
-- =====================================================================
create table if not exists public.holidays (
  id           bigint generated always as identity primary key,
  date         date not null unique,
  name         text not null,
  description  text default '',
  created_at   timestamptz not null default now()
);

-- =====================================================================
-- STORAGE BUCKET for payslip files
-- =====================================================================
-- Run this too (or create it manually in Dashboard > Storage):
-- insert into storage.buckets (id, name, public)
-- values ('payslips', 'payslips', false)
-- on conflict (id) do nothing;

-- =====================================================================
-- Row Level Security
-- =====================================================================
-- The backend uses the Supabase SECRET key, which always bypasses RLS,
-- so enabling RLS with no policies is the safest default: it blocks any
-- request made with the publishable/anon key (e.g. if that key ever
-- leaked to the frontend) while leaving the backend fully functional.
alter table public.users           enable row level security;
alter table public.attendance      enable row level security;
alter table public.leave_requests  enable row level security;
alter table public.payslips        enable row level security;
alter table public.requests        enable row level security;
alter table public.holidays        enable row level security;
