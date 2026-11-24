-- public_profiles is readable by anyone. A deleted account (deleted_at) or
-- one moderation hid (is_auto_hidden) must not appear there. Same columns as
-- before, so the app's reads are unchanged; only those rows drop out.
create or replace view public.public_profiles as
 select p.id,
    p.username,
    coalesce(aup.display_name, p.display_name, p.username, 'Viber'::text) as display_name,
    p.avatar_url,
    coalesce(aup.bio, p.bio) as bio,
    p.location,
    p.role,
    p.vibe_score,
    p.followers_count,
    p.following_count,
    p.xp,
    p.badges,
    p.is_verified as verified,
    p.show_online,
        case
            when p.show_online then p.last_seen
            else null::timestamp with time zone
        end as last_seen,
    p.updated_at
   from (profiles p
     left join app_user_profiles aup on (((aup.user_id = p.id) and (aup.app_id = current_app_id()))))
  where p.deleted_at is null
    and not coalesce(p.is_auto_hidden, false);
