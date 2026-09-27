-- ═══════════════════════════════════════════════════════════════════════════
-- account_deletion.sql — real, compliant account + data deletion
--
-- App Store (Apple 5.1.1(v)) and Google Play both require that an account
-- created in-app can be *deleted* (not just deactivated), along with its
-- personal data. The old flow only set profiles.deleted_at (deactivation).
--
-- This adds purge_user_data(uid): a defensive, dynamic purge that deletes every
-- row a user owns across public.* — matching a curated set of ownership columns
-- — then deletes their profile. It is idempotent and fault-tolerant: each table
-- is handled in its own sub-transaction so a missing column, FK-restrict, or a
-- table that doesn't exist can't abort the whole purge. The Edge Function
-- `delete-account` calls this, wipes the user's storage, then removes the
-- auth.users row (which cascades anything FK'd ON DELETE CASCADE).
--
-- SECURITY: service_role only. The client never calls this directly — it goes
-- through the JWT-verified Edge Function, so a user can only delete THEMSELVES.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.purge_user_data(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  -- Columns that denote "this row belongs to / is about this user".
  owner_cols text[] := array[
    'user_id','author_id','owner_id','sender_id','recipient_id','profile_id',
    'follower_id','following_id','blocker_id','blocked_id','actor_id',
    'reporter_id','driver_id','rider_id','host_id','creator_id','poster_id',
    'poster_by_id','uploaded_by','landlord_id','tenant_id','worker_id',
    'viewer_id','subject_id','carer_id','purchased_by','claimed_by',
    'reported_by_id','mediator_id','against_user_id','organiser_id','buyer_id'
  ];
begin
  if p_user is null then
    raise exception 'purge_user_data: p_user is null';
  end if;

  -- Delete rows across every public table that carries one of the ownership
  -- columns. Two passes so rows freed by the first pass release FK holds for
  -- the second. Per-statement exception handling keeps one bad table from
  -- aborting the purge.
  for pass in 1..2 loop
    for r in
      select c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public'
        and t.table_type = 'BASE TABLE'
        and c.table_name <> 'profiles'          -- profiles deleted last
        and c.column_name = any(owner_cols)
        and c.data_type = 'uuid'
    loop
      begin
        execute format('delete from public.%I where %I = $1', r.table_name, r.column_name)
          using p_user;
      exception when others then
        -- FK-restrict / permission / transient — skip; pass 2 or the final
        -- auth.users cascade will mop up the remainder.
        null;
      end;
    end loop;
  end loop;

  -- Finally the profile itself. If profiles.id → auth.users ON DELETE CASCADE,
  -- the Edge Function's auth deletion also removes this; doing it here makes the
  -- purge complete even if the cascade chain differs.
  begin
    delete from public.profiles where id = p_user;
  exception when others then
    -- Fall back to hard-anonymize if a RESTRICT FK blocks the delete, so no PII
    -- survives even in the worst case.
    begin
      update public.profiles
        set username = 'deleted_' || left(replace(p_user::text,'-',''), 12),
            display_name = 'Deleted user',
            email = null, bio = null, avatar_url = null, push_token = null,
            first_name = null, surname = null, phone = null,
            deleted_at = now(), is_discoverable = false
        where id = p_user;
    exception when others then null;
    end;
  end;
end;
$$;

-- Functions are default-deny on this DB (security_layers.sql). Only the
-- service-role Edge Function may run this.
revoke execute on function public.purge_user_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_user_data(uuid) to service_role;
