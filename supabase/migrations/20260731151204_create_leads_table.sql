create extension if not exists pgcrypto;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'contact_form'
    check (source in ('contact_form', 'quote_request', 'newsletter')),
  name text,
  email text not null,
  phone text,
  company text,
  vessel_type text,
  ladder_length numeric(4,1),
  product_interest text,
  message text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  email_sent boolean not null default false
);

alter table public.leads enable row level security;
-- No policies created on purpose: this table is only ever written/read via the
-- server-side Supabase client using the service role key, which bypasses RLS.
-- The anon/public key gets zero access by design.

create index leads_created_at_idx on public.leads (created_at desc);
create index leads_status_idx on public.leads (status);
