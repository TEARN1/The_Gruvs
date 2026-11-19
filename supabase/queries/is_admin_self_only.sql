-- is_admin(p_user_id) answered for ANY id and was callable without signing
-- in, so anyone could probe which accounts are admins (security advisor:
-- anon_security_definer_function_executable). Every real caller is an RLS
-- policy asking about the current user — is_admin(auth.uid()) on events,
-- reels, echoes and profiles — so answer only about yourself. Those policies
-- behave exactly as before; probing someone else now just returns false.
-- Same signature, so a drop-in replace. Idempotent.

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin'
  );
END;
$function$;
