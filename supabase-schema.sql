-- ============================================
-- Agency Task Board — Schema Supabase
-- Esegui questo script nell'SQL Editor di Supabase
-- ============================================

-- Tabella TASKS
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  project_name text,
  employee_id  text not null,
  priority     text not null default 'medium' check (priority in ('low','medium','high')),
  due_date     date,
  position     float8 not null default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Tabella COMMENTS
create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  author_name text not null,
  body        text not null,
  created_at  timestamptz default now()
);

-- Indici per performance
create index if not exists tasks_employee_id_idx on tasks(employee_id);
create index if not exists tasks_position_idx on tasks(position);
create index if not exists comments_task_id_idx on comments(task_id);

-- Trigger per updated_at automatico
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

-- Abilita Realtime per entrambe le tabelle
-- (puoi anche farlo dalla dashboard: Database > Replication)
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table comments;
