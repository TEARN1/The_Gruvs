-- fix_crew_invite_rls_recursion.sql
--
-- BUG: inviting anyone to a crew failed with
--   "infinite recursion detected in policy for relation crew_invites"
-- so no crew invite could ever be written.
--
-- CAUSE: two policies referenced each other's table with inline EXISTS
-- subqueries, and RLS re-applies to tables read inside a policy — so they
-- bounced forever:
--   crew_invites_select  →  SELECT ... FROM crews       (fires crews_select)
--   crews_select         →  SELECT ... FROM crew_invites (fires crew_invites_select) → ∞
-- The same inline cross-table pattern also appears in crew_invites_delete and
-- crew_members_insert, so any of them could re-trigger the loop.
--
-- FIX: do the cross-table checks through SECURITY DEFINER helpers (like the
-- existing is_crew_member), which run with RLS bypassed and therefore can't
-- recurse. Then rewrite every policy that inlined crews/crew_invites to call a
-- helper instead. Behaviour is identical; only the recursion is removed.

-- ── Helpers ────────────────────────────────────────────────────────────────
create or replace function public.is_crew_owner(p_crew uuid, p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.crews where id = p_crew and owner_id = p_user);
$$;

create or replace function public.has_crew_invite(p_crew uuid, p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.crew_invites
    where crew_id = p_crew and invitee_id = p_user
  );
$$;

create or replace function public.has_actionable_crew_invite(p_crew uuid, p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.crew_invites
    where crew_id = p_crew and invitee_id = p_user
      and status = any (array['pending','accepted'])
  );
$$;

-- ── crew_invites ───────────────────────────────────────────────────────────
drop policy if exists crew_invites_select on public.crew_invites;
create policy crew_invites_select on public.crew_invites for select
  using (
    invitee_id = auth.uid()
    or inviter_id = auth.uid()
    or public.is_crew_owner(crew_id, auth.uid())
  );

drop policy if exists crew_invites_delete on public.crew_invites;
create policy crew_invites_delete on public.crew_invites for delete
  using (
    inviter_id = auth.uid()
    or public.is_crew_owner(crew_id, auth.uid())
  );

-- ── crews ──────────────────────────────────────────────────────────────────
drop policy if exists crews_select on public.crews;
create policy crews_select on public.crews for select
  using (
    owner_id = auth.uid()
    or public.is_crew_member(id, auth.uid())
    or public.has_crew_invite(id, auth.uid())
  );

-- ── crew_members ───────────────────────────────────────────────────────────
drop policy if exists crew_members_insert on public.crew_members;
create policy crew_members_insert on public.crew_members for insert
  with check (
    public.is_crew_owner(crew_id, auth.uid())
    or (user_id = auth.uid() and public.has_actionable_crew_invite(crew_id, auth.uid()))
  );

drop policy if exists crew_members_delete on public.crew_members;
create policy crew_members_delete on public.crew_members for delete
  using (
    user_id = auth.uid()
    or public.is_crew_owner(crew_id, auth.uid())
  );
