create type public.app_role as enum ('admin', 'user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'lsephora67@gmail.com';

create table public.illustrations (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('character','environment','object')),
  key text not null unique,
  label text not null,
  prompt text not null,
  svg text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.illustrations to authenticated;
grant insert, update, delete on public.illustrations to authenticated;
grant all on public.illustrations to service_role;
alter table public.illustrations enable row level security;
create policy "Anyone signed in reads approved" on public.illustrations for select to authenticated using (status = 'approved' or public.has_role(auth.uid(), 'admin'));
create policy "Admins insert" on public.illustrations for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update" on public.illustrations for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete" on public.illustrations for delete to authenticated using (public.has_role(auth.uid(), 'admin'));