-- ═══════════════════════════════════════════════════════════════════════════
-- messages_video_type.sql — let the validated send path accept 'video'.
--
-- DM media now supports video (Photo / Video attachment). send_message_v2's
-- type allow-list didn't include 'video', so a video send failed Tier 1 and
-- only landed via the direct-insert fallback (two wasted RPC round-trips + a
-- logged error each time). This adds 'video' to the allow-list; nothing else
-- about the function changes. Reproduced verbatim from
-- messages_send_hardening.sql so this is a safe, idempotent CREATE OR REPLACE.
--
-- Add to DEPLOY_SQL_RUNBOOK.md Part 1 (depends on messages_send_hardening.sql).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.send_message_v2(
  p_recipient  uuid,
  p_body       text             DEFAULT NULL,
  p_type       text             DEFAULT 'text',
  p_media_url  text             DEFAULT NULL,
  p_event_id   uuid             DEFAULT NULL,
  p_parent_id  uuid             DEFAULT NULL,
  p_client_key text             DEFAULT NULL,
  p_lat        double precision DEFAULT NULL,
  p_lng        double precision DEFAULT NULL
)
RETURNS public.messages
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  uid      uuid := auth.uid();
  clean    text;
  accepted boolean := false;
  out_row  public.messages;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF p_recipient IS NULL OR p_recipient = uid THEN
    RAISE EXCEPTION 'invalid recipient';
  END IF;
  IF p_type NOT IN ('text','image','location','vibe_card','event','voice','video') THEN
    RAISE EXCEPTION 'invalid message type';
  END IF;
  IF (p_lat IS NULL) <> (p_lng IS NULL) THEN
    RAISE EXCEPTION 'incomplete coordinates';
  END IF;
  IF p_lat IS NOT NULL AND (p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180) THEN
    RAISE EXCEPTION 'coordinates out of range';
  END IF;
  IF p_lat IS NOT NULL AND p_type <> 'location' THEN
    RAISE EXCEPTION 'coordinates are only valid on a location message';
  END IF;

  IF p_client_key IS NOT NULL THEN
    SELECT * INTO out_row FROM public.messages
    WHERE sender_id = uid AND client_key = p_client_key LIMIT 1;
    IF FOUND THEN RETURN out_row; END IF;
  END IF;

  clean := NULLIF(btrim(COALESCE(p_body, '')), '');
  IF clean IS NULL AND p_media_url IS NULL AND p_event_id IS NULL AND p_lat IS NULL THEN
    RAISE EXCEPTION 'message is empty';
  END IF;
  IF length(clean) > 4000 THEN
    RAISE EXCEPTION 'message is too long';
  END IF;
  clean := regexp_replace(clean, '<script[^>]*>.*?</script>', '', 'gi');

  SELECT true INTO accepted
  FROM public.messages
  WHERE ((sender_id = uid AND recipient_id = p_recipient)
      OR (sender_id = p_recipient AND recipient_id = uid))
    AND request_accepted = true
  LIMIT 1;
  accepted := COALESCE(accepted, false);

  INSERT INTO public.messages
    (sender_id, recipient_id, body, message_type, media_url,
     event_id, parent_id, client_key, latitude, longitude,
     is_request, request_accepted)
  VALUES
    (uid, p_recipient, clean, p_type, p_media_url,
     p_event_id, p_parent_id, p_client_key, p_lat, p_lng,
     NOT accepted, accepted)
  RETURNING * INTO out_row;

  RETURN out_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_message_v2(uuid,text,text,text,uuid,uuid,text,double precision,double precision) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.send_message_v2(uuid,text,text,text,uuid,uuid,text,double precision,double precision) TO authenticated;
