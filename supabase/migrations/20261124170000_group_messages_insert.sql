-- Penetration test, 24 November 2026 (docs: TEARNs-Excellence
-- docs/pentest-2026-11.md, G12). The insert rule compared event_rsvps.event_id
-- with itself, so anyone "going" to one event could post in every event's
-- group chat, and it never checked sender_id, so a post could carry anyone's
-- name. Shown to work on the live database (rolled back), then fixed.
drop policy if exists "Users can send messages to events they RSVP'd to" on public.group_messages;
drop policy if exists group_messages_insert_going on public.group_messages;
create policy group_messages_insert_going on public.group_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.event_rsvps r
       where r.event_id = group_messages.event_id
         and r.user_id = (select auth.uid())
         and r.status = 'going'
    )
  );
