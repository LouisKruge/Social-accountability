-- ═════════════════════════════════════════════════════════════════════════════
-- MVP auth: auto-confirm new users (email/password without an email round-trip).
--
-- The spec ships email/password for the MVP with phone OTP as a fast-follow;
-- requiring an email confirmation click adds friction for the WhatsApp-first
-- target user and depends on SMTP that isn't set up. This BEFORE INSERT trigger
-- marks new auth users as email-confirmed so they can sign in immediately.
-- (Documented tradeoff: email ownership is not verified at MVP — revisit when
-- real SMTP / phone OTP lands. See DECISIONS.md.)
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.auto_confirm_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists auto_confirm_user_trg on auth.users;
create trigger auto_confirm_user_trg
  before insert on auth.users
  for each row execute function public.auto_confirm_user();
