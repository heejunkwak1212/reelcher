-- Migrate id/user_id columns from text -> uuid
-- Assumes existing text IDs contain UUID strings

begin;

-- Users
alter table users alter column id type uuid using id::uuid;

-- Profiles
alter table profiles alter column user_id type uuid using user_id::uuid;

-- Credits
alter table credits alter column user_id type uuid using user_id::uuid;

-- Searches
alter table searches alter column user_id type uuid using user_id::uuid;

commit;


