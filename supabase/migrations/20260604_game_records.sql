create table if not exists public.game_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null,
  game_type text not null default 'breakout',
  score integer not null default 0,
  play_duration real not null default 0,
  played_at timestamptz not null default now()
);

create index idx_game_records_user on public.game_records(user_id);
create index idx_game_records_room on public.game_records(room_id);
create index idx_game_records_type_duration on public.game_records(game_type, play_duration);

alter table public.game_records enable row level security;

create policy "game_records_select" on public.game_records
  for select using (true);

create policy "game_records_insert" on public.game_records
  for insert with check (auth.uid() = user_id);
