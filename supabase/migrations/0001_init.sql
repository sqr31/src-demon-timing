-- The Hunt: initial schema.
-- All access happens server-side with the service role key, so RLS is enabled
-- with no policies: the anon/publishable key can read nothing.

create type solve_type as enum ('qr', 'answer');

create table players (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique,
  display_name text not null,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

create table components (
  id uuid primary key default gen_random_uuid(),
  stage int not null check (stage between 1 and 6),
  position int not null check (position > 0),
  title text not null,
  clue_text text not null default '',
  solve_type solve_type not null,
  qr_token text unique,
  answer text,
  release_at timestamptz not null default now(),
  hint_text text not null default '',
  hint_released boolean not null default false,
  fragment text,
  unique (stage, position),
  -- qr components carry a token and nothing else; answer components the reverse.
  constraint components_solve_fields check (
    case solve_type
      when 'qr' then qr_token is not null and answer is null
      when 'answer' then answer is not null and qr_token is null
    end
  )
);

-- The global order every gating check walks: stage, then position within stage.
create index components_order_idx on components (stage, position);

create table progress (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id) on delete cascade,
  component_id uuid not null references components (id) on delete cascade,
  solved_at timestamptz not null default now(),
  unique (player_id, component_id)
);

create index progress_player_idx on progress (player_id);

-- Login throttling. Serverless instances share no memory, so attempts live here.
create table login_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  attempted_at timestamptz not null default now()
);

create index login_attempts_lookup_idx on login_attempts (student_id, attempted_at desc);

alter table players enable row level security;
alter table components enable row level security;
alter table progress enable row level security;
alter table login_attempts enable row level security;

-- Rule 6: a solve is timestamped once and never overwritten.
create function progress_is_append_only() returns trigger as $$
begin
  raise exception 'progress rows are append-only';
end;
$$ language plpgsql;

create trigger progress_no_update
  before update on progress
  for each row execute function progress_is_append_only();
