-- Enable RLS and add basic owner policies (Supabase: auth.uid())

alter table profiles enable row level security;
alter table users enable row level security;
alter table credits enable row level security;
alter table searches enable row level security;

-- Users: each user can see their own row
create policy users_select_self on users for select using ( auth.uid() = id );
create policy users_insert_self on users for insert with check ( auth.uid() = id );
create policy users_update_self on users for update using ( auth.uid() = id );

-- Profiles: owner-only
create policy profiles_select_self on profiles for select using ( auth.uid() = user_id );
create policy profiles_insert_self on profiles for insert with check ( auth.uid() = user_id );
create policy profiles_update_self on profiles for update using ( auth.uid() = user_id );

-- Credits: owner-only
create policy credits_select_self on credits for select using ( auth.uid() = user_id );
create policy credits_update_self on credits for update using ( auth.uid() = user_id );
create policy credits_insert_self on credits for insert with check ( auth.uid() = user_id );

-- Searches: owner-only
create policy searches_select_self on searches for select using ( auth.uid() = user_id );
create policy searches_insert_self on searches for insert with check ( auth.uid() = user_id );
create policy searches_update_self on searches for update using ( auth.uid() = user_id );

