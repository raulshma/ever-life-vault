

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'Security update 2025-08-17: upsert_clip function now has explicit search_path. Manual action required: Enable leaked password protection in Supabase Auth dashboard.';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."cleanup_expired_vault_sessions"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.vault_sessions WHERE expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_vault_sessions"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_vault_sessions"() IS 'Clean up expired vault sessions with explicit search_path for security';



CREATE OR REPLACE FUNCTION "public"."clips_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."clips_set_updated_at"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."clips_set_updated_at"() IS 'Trigger function to update clips timestamp with explicit search_path for security';



CREATE OR REPLACE FUNCTION "public"."delete_docker_compose_config"("_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.docker_compose_configs
  WHERE user_id = (SELECT auth.uid()) AND name = _name;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;


ALTER FUNCTION "public"."delete_docker_compose_config"("_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_docker_compose_config"("_name" "text") IS 'Delete Docker Compose config with explicit search_path for security';



CREATE OR REPLACE FUNCTION "public"."delete_infrastructure_secret"("_key" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.infrastructure_secrets
  WHERE user_id = (SELECT auth.uid()) AND key = _key;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;


ALTER FUNCTION "public"."delete_infrastructure_secret"("_key" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_infrastructure_secret"("_key" "text") IS 'Delete infrastructure secret with explicit search_path for security';



CREATE OR REPLACE FUNCTION "public"."end_live_share"("_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _creator uuid;
begin
  select created_by into _creator from public.live_share_rooms where id = _id;
  if _creator is null then
    -- Nothing to do
    return;
  end if;
  if auth.uid() is null or auth.uid() <> _creator then
    raise exception 'permission denied to end this live share';
  end if;

  -- Remove telemetry/events first (table owner bypasses RLS)
  delete from public.live_share_events where room_id = _id;
  -- Remove the room
  delete from public.live_share_rooms where id = _id;
end;
$$;


ALTER FUNCTION "public"."end_live_share"("_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_custom_data_object"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF jsonb_typeof(NEW.custom_data) IS DISTINCT FROM 'object' THEN
    NEW.custom_data := '{}'::jsonb;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_custom_data_object"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enforce_custom_data_object"() IS 'Enforce custom data object structure with explicit search_path for security';



CREATE OR REPLACE FUNCTION "public"."get_clip"("_id" "text", "_proof" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "text", "content" "text", "expires_at" timestamp with time zone, "updated_at" timestamp with time zone, "has_password" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT c.id, c.content, c.expires_at, c.updated_at, (c.password_proof IS NOT NULL) AS has_password
  FROM public.clips c
  WHERE c.id = _id
    AND (c.expires_at IS NULL OR NOW() <= c.expires_at)
    AND (c.password_proof IS NULL OR c.password_proof = _proof)
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_clip"("_id" "text", "_proof" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_clip"("_id" "text", "_proof" "text") IS 'Get clip content with explicit search_path for security';



CREATE OR REPLACE FUNCTION "public"."get_clip_meta"("_id" "text") RETURNS TABLE("clip_exists" boolean, "has_password" boolean, "expires_at" timestamp with time zone, "updated_at" timestamp with time zone, "password_salt" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    EXISTS(SELECT 1 FROM public.clips WHERE id = _id AND (expires_at IS NULL OR NOW() <= expires_at)) AS clip_exists,
    COALESCE((SELECT password_proof IS NOT NULL FROM public.clips WHERE id = _id LIMIT 1), false) AS has_password,
    (SELECT expires_at FROM public.clips WHERE id = _id LIMIT 1) AS expires_at,
    (SELECT updated_at FROM public.clips WHERE id = _id LIMIT 1) AS updated_at,
    (SELECT password_salt FROM public.clips WHERE id = _id LIMIT 1) AS password_salt;
$$;


ALTER FUNCTION "public"."get_clip_meta"("_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_clip_meta"("_id" "text") IS 'Get clip metadata with explicit search_path for security';



CREATE OR REPLACE FUNCTION "public"."get_clip_one_time"("_id" "text", "_proof" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "text", "content" "text", "expires_at" timestamp with time zone, "updated_at" timestamp with time zone, "has_password" boolean, "one_time_view" boolean, "view_count" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH clip_data AS (
    SELECT c.*
    FROM public.clips c
    WHERE c.id = _id
      AND (c.expires_at IS NULL OR NOW() <= c.expires_at)
      AND (c.password_proof IS NULL OR c.password_proof = _proof)
    LIMIT 1
  ),
  updated_clip AS (
    UPDATE public.clips 
    SET view_count = view_count + 1
    WHERE id = _id 
      AND one_time_view = true 
      AND view_count = 0
  ),
  deleted_clip AS (
    DELETE FROM public.clips 
    WHERE id = _id 
      AND one_time_view = true 
      AND view_count > 0
  )
  SELECT 
    c.id,
    c.content,
    c.expires_at,
    c.updated_at,
    (c.password_proof IS NOT NULL) AS has_password,
    c.one_time_view,
    c.view_count
  FROM clip_data c;
$$;


ALTER FUNCTION "public"."get_clip_one_time"("_id" "text", "_proof" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_docker_compose_config"("_name" "text") RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "compose_content" "text", "metadata" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT c.id, c.name, c.description, c.compose_content, c.metadata, c.created_at, c.updated_at
  FROM public.docker_compose_configs c
  WHERE c.user_id = (SELECT auth.uid()) AND c.name = _name
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_docker_compose_config"("_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_docker_compose_config"("_name" "text") IS 'Get Docker Compose config with explicit search_path for security';



CREATE OR REPLACE FUNCTION "public"."get_infrastructure_secret"("_key" "text") RETURNS TABLE("id" "uuid", "key" "text", "encrypted_value" "text", "iv" "text", "auth_tag" "text", "salt" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT s.id, s.key, s.encrypted_value, s.iv, s.auth_tag, s.salt, s.created_at, s.updated_at
  FROM public.infrastructure_secrets s
  WHERE s.user_id = (SELECT auth.uid()) AND s.key = _key
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_infrastructure_secret"("_key" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_infrastructure_secret"("_key" "text") IS 'Retrieve encrypted infrastructure secret with explicit search_path for security';



CREATE OR REPLACE FUNCTION "public"."get_live_share_participant_status"("_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_status text;
begin
  select status into v_status from public.live_share_participants where id = _id;
  return v_status;
end;
$$;


ALTER FUNCTION "public"."get_live_share_participant_status"("_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_docker_compose_configs"() RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "metadata" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT c.id, c.name, c.description, c.metadata, c.created_at, c.updated_at
  FROM public.docker_compose_configs c
  WHERE c.user_id = (SELECT auth.uid())
  ORDER BY c.name;
$$;


ALTER FUNCTION "public"."list_docker_compose_configs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."list_docker_compose_configs"() IS 'List Docker Compose configs with explicit search_path for security';



CREATE OR REPLACE FUNCTION "public"."list_infrastructure_secret_keys"() RETURNS TABLE("id" "uuid", "key" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT s.id, s.key, s.created_at, s.updated_at
  FROM public.infrastructure_secrets s
  WHERE s.user_id = (SELECT auth.uid())
  ORDER BY s.key;
$$;


ALTER FUNCTION "public"."list_infrastructure_secret_keys"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."list_infrastructure_secret_keys"() IS 'List infrastructure secret keys with explicit search_path for security';



CREATE OR REPLACE FUNCTION "public"."purge_expired_live_shares"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _cutoff timestamptz := now();
  _count int := 0;
begin
  -- Delete events for rooms that are expired
  delete from public.live_share_events e
  using public.live_share_rooms r
  where e.room_id = r.id and r.expires_at is not null and r.expires_at < _cutoff;

  -- Delete the expired rooms
  delete from public.live_share_rooms r
  where r.expires_at is not null and r.expires_at < _cutoff;

  get diagnostics _count = row_count;
  return _count;
end;
$$;


ALTER FUNCTION "public"."purge_expired_live_shares"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_live_share_invite"("_code" "text", "_display_name" "text") RETURNS TABLE("room_id" "text", "participant_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_room text;
  v_creator uuid;
  v_expires timestamptz;
  v_max int;
  v_uses int;
  v_uid uuid;
  v_participant_id uuid;
begin
  select room_id, created_by, expires_at, max_uses, use_count
  into v_room, v_creator, v_expires, v_max, v_uses
  from public.live_share_invites
  where code = _code;

  if v_room is null then
    raise exception 'invalid invite code';
  end if;
  if v_expires is not null and v_expires < now() then
    raise exception 'invite expired';
  end if;
  if v_uses >= v_max then
    raise exception 'invite exhausted';
  end if;

  v_uid := auth.uid();

  -- increment use_count
  update public.live_share_invites
    set use_count = use_count + 1
    where code = _code;

  -- create pending participant
  insert into public.live_share_participants(room_id, user_id, display_name, role, status)
  values (v_room, v_uid, coalesce(_display_name, 'Guest'), 'guest', 'pending')
  returning id into v_participant_id;

  return query select v_room, v_participant_id;
end;
$$;


ALTER FUNCTION "public"."redeem_live_share_invite"("_code" "text", "_display_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_live_share_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_live_share_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_live_share_participant_status"("_participant_id" "uuid", "_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_room text;
  v_creator uuid;
begin
  if _status not in ('approved','banned') then
    raise exception 'invalid status';
  end if;
  select room_id into v_room from public.live_share_participants where id = _participant_id;
  if v_room is null then
    raise exception 'participant not found';
  end if;
  select created_by into v_creator from public.live_share_rooms where id = v_room;
  if auth.uid() is null or auth.uid() <> v_creator then
    raise exception 'permission denied';
  end if;
  update public.live_share_participants
    set status = _status,
        approved_at = case when _status = 'approved' then now() else approved_at end
    where id = _participant_id;
end;
$$;


ALTER FUNCTION "public"."set_live_share_participant_status"("_participant_id" "uuid", "_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."store_docker_compose_config"("_name" "text", "_description" "text", "_compose_content" "text", "_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  config_id UUID;
BEGIN
  -- Insert or update the configuration
  INSERT INTO public.docker_compose_configs (user_id, name, description, compose_content, metadata)
  VALUES ((SELECT auth.uid()), _name, _description, _compose_content, _metadata)
  ON CONFLICT (user_id, name) 
  DO UPDATE SET 
    description = EXCLUDED.description,
    compose_content = EXCLUDED.compose_content,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO config_id;
  
  RETURN config_id;
END;
$$;


ALTER FUNCTION "public"."store_docker_compose_config"("_name" "text", "_description" "text", "_compose_content" "text", "_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."store_docker_compose_config"("_name" "text", "_description" "text", "_compose_content" "text", "_metadata" "jsonb") IS 'Store Docker Compose config with explicit search_path for security';



CREATE OR REPLACE FUNCTION "public"."store_infrastructure_secret"("_key" "text", "_encrypted_value" "text", "_iv" "text", "_auth_tag" "text", "_salt" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  secret_id UUID;
BEGIN
  -- Insert or update the secret
  INSERT INTO public.infrastructure_secrets (user_id, key, encrypted_value, iv, auth_tag, salt)
  VALUES ((SELECT auth.uid()), _key, _encrypted_value, _iv, _auth_tag, _salt)
  ON CONFLICT (user_id, key) 
  DO UPDATE SET 
    encrypted_value = EXCLUDED.encrypted_value,
    iv = EXCLUDED.iv,
    auth_tag = EXCLUDED.auth_tag,
    salt = EXCLUDED.salt,
    updated_at = NOW()
  RETURNING id INTO secret_id;
  
  RETURN secret_id;
END;
$$;


ALTER FUNCTION "public"."store_infrastructure_secret"("_key" "text", "_encrypted_value" "text", "_iv" "text", "_auth_tag" "text", "_salt" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."store_infrastructure_secret"("_key" "text", "_encrypted_value" "text", "_iv" "text", "_auth_tag" "text", "_salt" "text") IS 'Store encrypted infrastructure secret with explicit search_path for security';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_clip"("_id" "text", "_content" "text", "_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "_proof" "text" DEFAULT NULL::"text", "_set_password_proof" "text" DEFAULT NULL::"text", "_set_password_salt" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Call the 7-parameter version with default one_time_view = false
  RETURN public.upsert_clip(_id, _content, _expires_at, _proof, _set_password_proof, _set_password_salt, false);
END;
$$;


ALTER FUNCTION "public"."upsert_clip"("_id" "text", "_content" "text", "_expires_at" timestamp with time zone, "_proof" "text", "_set_password_proof" "text", "_set_password_salt" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."upsert_clip"("_id" "text", "_content" "text", "_expires_at" timestamp with time zone, "_proof" "text", "_set_password_proof" "text", "_set_password_salt" "text") IS 'Create or update clip with explicit search_path for security (backward compatibility)';



CREATE OR REPLACE FUNCTION "public"."upsert_clip"("_id" "text", "_content" "text", "_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "_proof" "text" DEFAULT NULL::"text", "_set_password_proof" "text" DEFAULT NULL::"text", "_set_password_salt" "text" DEFAULT NULL::"text", "_one_time_view" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  existing record;
BEGIN
  SELECT * INTO existing FROM public.clips WHERE id = _id LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.clips (id, content, created_by, expires_at, password_proof, password_salt, one_time_view)
    VALUES (_id, _content, (SELECT auth.uid()), _expires_at, _set_password_proof, _set_password_salt, _one_time_view);
    RETURN true;
  END IF;

  -- Gate updates when password is set
  IF existing.password_proof IS NOT NULL THEN
    IF _proof IS NULL OR _proof <> existing.password_proof THEN
      RETURN false;
    END IF;
  END IF;

  -- Don't allow changing one_time_view after creation
  UPDATE public.clips
  SET content = _content,
      expires_at = _expires_at,
      password_proof = COALESCE(_set_password_proof, existing.password_proof),
      password_salt = COALESCE(_set_password_salt, existing.password_salt),
      updated_at = NOW()
  WHERE id = _id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."upsert_clip"("_id" "text", "_content" "text", "_expires_at" timestamp with time zone, "_proof" "text", "_set_password_proof" "text", "_set_password_salt" "text", "_one_time_view" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."upsert_clip"("_id" "text", "_content" "text", "_expires_at" timestamp with time zone, "_proof" "text", "_set_password_proof" "text", "_set_password_salt" "text", "_one_time_view" boolean) IS 'Create or update clip with explicit search_path for security and one-time view support';



CREATE OR REPLACE FUNCTION "public"."verify_live_share_access"("_id" "text", "_proof" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE((SELECT (password_proof IS NOT NULL AND password_proof = _proof)
                   FROM public.live_share_rooms
                   WHERE id = _id), false);
$$;


ALTER FUNCTION "public"."verify_live_share_access"("_id" "text", "_proof" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."clips" (
    "id" "text" NOT NULL,
    "content" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "password_proof" "text",
    "password_salt" "text",
    "one_time_view" boolean DEFAULT false,
    "view_count" integer DEFAULT 0
);


ALTER TABLE "public"."clips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dashboard_layouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "layout_tree" "jsonb" NOT NULL,
    "widget_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dashboard_layouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."docker_compose_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "compose_content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."docker_compose_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."docker_compose_configs" IS 'Stores Docker Compose configurations for homelab infrastructure management';



COMMENT ON COLUMN "public"."docker_compose_configs"."compose_content" IS 'The actual docker-compose.yml file content with secret placeholders';



COMMENT ON COLUMN "public"."docker_compose_configs"."metadata" IS 'Structured metadata about services, volumes, networks extracted from compose file';



CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "file_path" "text",
    "file_size" bigint,
    "mime_type" "text",
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "expiry_date" "date",
    "purchase_date" "date",
    "value" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."encrypted_vault_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "encrypted_data" "text" NOT NULL,
    "iv" "text" NOT NULL,
    "auth_tag" "text" NOT NULL,
    "item_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "encrypted_vault_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['login'::"text", 'note'::"text", 'api'::"text", 'document'::"text"])))
);


ALTER TABLE "public"."encrypted_vault_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."encrypted_vault_items" IS 'Stores end-to-end encrypted vault items using AES-256-GCM';



COMMENT ON COLUMN "public"."encrypted_vault_items"."encrypted_data" IS 'Base64 encoded AES-256-GCM encrypted JSON data';



COMMENT ON COLUMN "public"."encrypted_vault_items"."iv" IS 'Base64 encoded initialization vector (12 bytes for GCM)';



COMMENT ON COLUMN "public"."encrypted_vault_items"."auth_tag" IS 'Base64 encoded authentication tag (16 bytes for GCM)';



COMMENT ON COLUMN "public"."encrypted_vault_items"."name" IS 'Unencrypted item name for search and display purposes';



CREATE TABLE IF NOT EXISTS "public"."focus_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "mode" "text" NOT NULL,
    "profile" "text",
    "bpm" integer DEFAULT 20 NOT NULL,
    "accent_every" integer DEFAULT 4 NOT NULL,
    "subdivisions" integer DEFAULT 1 NOT NULL,
    "is_break" boolean DEFAULT false NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "duration_seconds" integer GENERATED ALWAYS AS (
CASE
    WHEN ("ended_at" IS NULL) THEN NULL::integer
    ELSE GREATEST(0, (EXTRACT(epoch FROM ("ended_at" - "started_at")))::integer)
END) STORED,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."focus_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."focus_sessions" IS 'Per-user focus timer sessions with optional task link and metronome settings';



CREATE TABLE IF NOT EXISTS "public"."infrastructure_secrets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "key" "text" NOT NULL,
    "encrypted_value" "text" NOT NULL,
    "iv" "text" NOT NULL,
    "auth_tag" "text" NOT NULL,
    "salt" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."infrastructure_secrets" OWNER TO "postgres";


COMMENT ON TABLE "public"."infrastructure_secrets" IS 'Stores encrypted secrets for Docker Compose configurations using AES-256-GCM';



COMMENT ON COLUMN "public"."infrastructure_secrets"."key" IS 'The secret key/name (unencrypted for reference and searching)';



COMMENT ON COLUMN "public"."infrastructure_secrets"."encrypted_value" IS 'Base64 encoded AES-256-GCM encrypted secret value';



COMMENT ON COLUMN "public"."infrastructure_secrets"."iv" IS 'Base64 encoded initialization vector (12 bytes for GCM)';



COMMENT ON COLUMN "public"."infrastructure_secrets"."auth_tag" IS 'Base64 encoded authentication tag (16 bytes for GCM)';



COMMENT ON COLUMN "public"."infrastructure_secrets"."salt" IS 'Base64 encoded salt for key derivation (32 bytes)';



CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "value" numeric(10,2),
    "purchase_date" "date",
    "warranty_expires" "date",
    "image_url" "text",
    "has_qr_code" boolean DEFAULT false NOT NULL,
    "qr_code_data" "text",
    "is_lent" boolean DEFAULT false NOT NULL,
    "lent_to" "text",
    "lent_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_share_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "text" NOT NULL,
    "event" "text" NOT NULL,
    "peer_id" "text",
    "encryption_enabled" boolean,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."live_share_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_share_invites" (
    "code" "text" NOT NULL,
    "room_id" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "max_uses" integer DEFAULT 1 NOT NULL,
    "use_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."live_share_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_share_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "text" NOT NULL,
    "user_id" "uuid",
    "display_name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_at" timestamp with time zone,
    CONSTRAINT "live_share_participants_role_check" CHECK (("role" = ANY (ARRAY['host'::"text", 'guest'::"text"]))),
    CONSTRAINT "live_share_participants_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'banned'::"text"])))
);


ALTER TABLE "public"."live_share_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_share_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text" NOT NULL,
    "actions" "text"[] NOT NULL,
    "granted_to" "text" DEFAULT 'guests'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."live_share_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_share_rooms" (
    "id" "text" NOT NULL,
    "max_peers" smallint NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "password_salt" "text",
    "password_proof" "text",
    "expires_at" timestamp with time zone,
    "locked" boolean DEFAULT false NOT NULL,
    CONSTRAINT "live_share_rooms_max_peers_check" CHECK ((("max_peers" >= 2) AND ("max_peers" <= 8)))
);


ALTER TABLE "public"."live_share_rooms" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."live_share_rooms_public" WITH ("security_invoker"='true') AS
 SELECT "id",
    "max_peers",
    "locked",
    "created_by",
    "expires_at",
    "created_at",
    "password_salt"
   FROM "public"."live_share_rooms";


ALTER VIEW "public"."live_share_rooms_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text" DEFAULT 'Home'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mal_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mal_user_id" bigint NOT NULL,
    "mal_username" "text" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "mean_score" numeric(4,2),
    "days_watched" numeric(6,2),
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "synced_at" timestamp with time zone
);


ALTER TABLE "public"."mal_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mal_anime" (
    "mal_id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "title_english" "text",
    "main_picture" "jsonb",
    "media_type" "text",
    "start_date" "date",
    "end_date" "date",
    "status" "text",
    "season_year" integer,
    "season_name" "text",
    "mean" double precision,
    "rank" integer,
    "popularity" integer,
    "genres" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mal_anime" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mal_recommendations" (
    "user_id" "uuid" NOT NULL,
    "mal_id" bigint NOT NULL,
    "source" "text" NOT NULL,
    "score" double precision NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mal_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mal_tokens" (
    "user_id" "uuid" NOT NULL,
    "access_encrypted" "text" NOT NULL,
    "refresh_encrypted" "text",
    "iv" "text" NOT NULL,
    "auth_tag" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mal_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mal_user_list_entries" (
    "user_id" "uuid" NOT NULL,
    "mal_id" bigint NOT NULL,
    "status" "text" NOT NULL,
    "score" integer,
    "num_episodes_watched" integer,
    "priority" integer,
    "comments" "text",
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."mal_user_list_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mal_watch_history" (
    "user_id" "uuid" NOT NULL,
    "mal_id" bigint NOT NULL,
    "episode" integer NOT NULL,
    "watched_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."mal_watch_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monthly_status_sheets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "month_year" "text" NOT NULL,
    "day_number" integer NOT NULL,
    "status" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "custom_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "monthly_status_sheets_day_number_check" CHECK ((("day_number" >= 1) AND ("day_number" <= 31)))
);


ALTER TABLE "public"."monthly_status_sheets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "is_favorite" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."steam_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "steamid64" "text" NOT NULL,
    "persona_name" "text",
    "avatar_url" "text",
    "profile_visibility" "text",
    "country" "text",
    "steam_level" integer,
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "synced_at" timestamp with time zone
);


ALTER TABLE "public"."steam_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."steam_achievements" (
    "user_id" "uuid" NOT NULL,
    "appid" integer NOT NULL,
    "apiname" "text" NOT NULL,
    "achieved" boolean NOT NULL,
    "unlocktime" timestamp with time zone
);


ALTER TABLE "public"."steam_achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."steam_game_stats" (
    "user_id" "uuid" NOT NULL,
    "appid" integer NOT NULL,
    "stat_name" "text" NOT NULL,
    "stat_value" double precision NOT NULL
);


ALTER TABLE "public"."steam_game_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."steam_games" (
    "appid" integer NOT NULL,
    "name" "text",
    "header_image" "text",
    "genres" "jsonb",
    "metascore" integer,
    "is_free" boolean,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."steam_games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."steam_ownership" (
    "user_id" "uuid" NOT NULL,
    "appid" integer NOT NULL,
    "playtime_forever_minutes" integer DEFAULT 0 NOT NULL,
    "playtime_2weeks_minutes" integer DEFAULT 0 NOT NULL,
    "last_played_at" timestamp with time zone
);


ALTER TABLE "public"."steam_ownership" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "due_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'in-progress'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "namespace" "text" NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_configs_key_check" CHECK (("char_length"("key") <= 128)),
    CONSTRAINT "user_configs_namespace_check" CHECK (("char_length"("namespace") <= 64))
);


ALTER TABLE "public"."user_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_configs" IS 'Generic per-user namespaced configuration store';



COMMENT ON COLUMN "public"."user_configs"."namespace" IS 'Logical grouping, e.g. settings, dashboard, mss';



COMMENT ON COLUMN "public"."user_configs"."key" IS 'Config key within a namespace';



COMMENT ON COLUMN "public"."user_configs"."value" IS 'Arbitrary JSON payload';



CREATE TABLE IF NOT EXISTS "public"."vault_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "salt" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vault_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."vault_config" IS 'Stores vault configuration including salt for PBKDF2 key derivation';



COMMENT ON COLUMN "public"."vault_config"."salt" IS 'Base64 encoded salt for PBKDF2 key derivation (32 bytes)';



CREATE TABLE IF NOT EXISTS "public"."vault_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "server_secret" "text" NOT NULL
);


ALTER TABLE "public"."vault_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."vault_sessions" IS 'RLS: select/update/insert/delete restricted to owner; expired sessions effectively invisible; future expiry enforced.';



ALTER TABLE ONLY "public"."clips"
    ADD CONSTRAINT "clips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_layouts"
    ADD CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_layouts"
    ADD CONSTRAINT "dashboard_layouts_user_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."docker_compose_configs"
    ADD CONSTRAINT "docker_compose_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."encrypted_vault_items"
    ADD CONSTRAINT "encrypted_vault_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."infrastructure_secrets"
    ADD CONSTRAINT "infrastructure_secrets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_share_events"
    ADD CONSTRAINT "live_share_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_share_invites"
    ADD CONSTRAINT "live_share_invites_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."live_share_participants"
    ADD CONSTRAINT "live_share_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_share_permissions"
    ADD CONSTRAINT "live_share_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_share_rooms"
    ADD CONSTRAINT "live_share_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mal_accounts"
    ADD CONSTRAINT "mal_accounts_mal_user_id_key" UNIQUE ("mal_user_id");



ALTER TABLE ONLY "public"."mal_accounts"
    ADD CONSTRAINT "mal_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mal_accounts"
    ADD CONSTRAINT "mal_accounts_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."mal_anime"
    ADD CONSTRAINT "mal_anime_pkey" PRIMARY KEY ("mal_id");



ALTER TABLE ONLY "public"."mal_recommendations"
    ADD CONSTRAINT "mal_recommendations_pkey" PRIMARY KEY ("user_id", "mal_id", "source");



ALTER TABLE ONLY "public"."mal_tokens"
    ADD CONSTRAINT "mal_tokens_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."mal_user_list_entries"
    ADD CONSTRAINT "mal_user_list_entries_pkey" PRIMARY KEY ("user_id", "mal_id");



ALTER TABLE ONLY "public"."mal_watch_history"
    ADD CONSTRAINT "mal_watch_history_pkey" PRIMARY KEY ("user_id", "mal_id", "episode");



ALTER TABLE ONLY "public"."monthly_status_sheets"
    ADD CONSTRAINT "monthly_status_sheets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_status_sheets"
    ADD CONSTRAINT "monthly_status_sheets_user_id_month_year_day_number_key" UNIQUE ("user_id", "month_year", "day_number");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."steam_accounts"
    ADD CONSTRAINT "steam_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."steam_accounts"
    ADD CONSTRAINT "steam_accounts_steamid64_key" UNIQUE ("steamid64");



ALTER TABLE ONLY "public"."steam_accounts"
    ADD CONSTRAINT "steam_accounts_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."steam_achievements"
    ADD CONSTRAINT "steam_achievements_pkey" PRIMARY KEY ("user_id", "appid", "apiname");



ALTER TABLE ONLY "public"."steam_game_stats"
    ADD CONSTRAINT "steam_game_stats_pkey" PRIMARY KEY ("user_id", "appid", "stat_name");



ALTER TABLE ONLY "public"."steam_games"
    ADD CONSTRAINT "steam_games_pkey" PRIMARY KEY ("appid");



ALTER TABLE ONLY "public"."steam_ownership"
    ADD CONSTRAINT "steam_ownership_pkey" PRIMARY KEY ("user_id", "appid");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."docker_compose_configs"
    ADD CONSTRAINT "unique_config_name_per_user" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."infrastructure_secrets"
    ADD CONSTRAINT "unique_secret_key_per_user" UNIQUE ("user_id", "key");



ALTER TABLE ONLY "public"."user_configs"
    ADD CONSTRAINT "user_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_configs"
    ADD CONSTRAINT "user_configs_user_id_namespace_key_key" UNIQUE ("user_id", "namespace", "key");



ALTER TABLE ONLY "public"."vault_config"
    ADD CONSTRAINT "vault_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vault_config"
    ADD CONSTRAINT "vault_config_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."vault_sessions"
    ADD CONSTRAINT "vault_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vault_sessions"
    ADD CONSTRAINT "vault_sessions_user_id_session_id_key" UNIQUE ("user_id", "session_id");



CREATE INDEX "idx_dashboard_layouts_user" ON "public"."dashboard_layouts" USING "btree" ("user_id");



CREATE INDEX "idx_docker_compose_configs_name" ON "public"."docker_compose_configs" USING "btree" ("name");



CREATE INDEX "idx_docker_compose_configs_user_id" ON "public"."docker_compose_configs" USING "btree" ("user_id");



CREATE INDEX "idx_documents_category" ON "public"."documents" USING "btree" ("category");



CREATE INDEX "idx_documents_expiry_date" ON "public"."documents" USING "btree" ("expiry_date");



CREATE INDEX "idx_documents_user_id" ON "public"."documents" USING "btree" ("user_id");



CREATE INDEX "idx_encrypted_vault_items_name" ON "public"."encrypted_vault_items" USING "btree" ("name");



CREATE INDEX "idx_encrypted_vault_items_type" ON "public"."encrypted_vault_items" USING "btree" ("item_type");



CREATE INDEX "idx_encrypted_vault_items_user_id" ON "public"."encrypted_vault_items" USING "btree" ("user_id");



CREATE INDEX "idx_focus_sessions_task" ON "public"."focus_sessions" USING "btree" ("task_id");



CREATE INDEX "idx_focus_sessions_user_started_at" ON "public"."focus_sessions" USING "btree" ("user_id", "started_at" DESC);



CREATE INDEX "idx_infrastructure_secrets_key" ON "public"."infrastructure_secrets" USING "btree" ("key");



CREATE INDEX "idx_infrastructure_secrets_user_id" ON "public"."infrastructure_secrets" USING "btree" ("user_id");



CREATE INDEX "idx_inventory_items_location_id" ON "public"."inventory_items" USING "btree" ("location_id");



CREATE INDEX "idx_inventory_items_user_id" ON "public"."inventory_items" USING "btree" ("user_id");



CREATE INDEX "idx_live_share_rooms_created_by" ON "public"."live_share_rooms" USING "btree" ("created_by");



CREATE INDEX "idx_locations_user_id" ON "public"."locations" USING "btree" ("user_id");



CREATE INDEX "idx_lsi_expires" ON "public"."live_share_invites" USING "btree" ("expires_at");



CREATE INDEX "idx_lsi_room" ON "public"."live_share_invites" USING "btree" ("room_id");



CREATE INDEX "idx_lsp_room" ON "public"."live_share_participants" USING "btree" ("room_id");



CREATE INDEX "idx_lsp_user" ON "public"."live_share_participants" USING "btree" ("user_id");



CREATE INDEX "idx_lspm_room" ON "public"."live_share_permissions" USING "btree" ("room_id");



CREATE INDEX "idx_notes_tags" ON "public"."notes" USING "gin" ("tags");



CREATE INDEX "idx_notes_user_id" ON "public"."notes" USING "btree" ("user_id");



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "idx_tasks_user_id" ON "public"."tasks" USING "btree" ("user_id");



CREATE INDEX "idx_user_configs_user_ns" ON "public"."user_configs" USING "btree" ("user_id", "namespace");



CREATE INDEX "idx_user_configs_user_ns_key" ON "public"."user_configs" USING "btree" ("user_id", "namespace", "key");



CREATE INDEX "idx_vault_config_user_id" ON "public"."vault_config" USING "btree" ("user_id");



CREATE INDEX "idx_vault_sessions_expires_at" ON "public"."vault_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_vault_sessions_user_expires_at" ON "public"."vault_sessions" USING "btree" ("user_id", "expires_at");



CREATE INDEX "idx_vault_sessions_user_id" ON "public"."vault_sessions" USING "btree" ("user_id");



CREATE INDEX "mal_accounts_user_id_idx" ON "public"."mal_accounts" USING "btree" ("user_id");



CREATE INDEX "mal_user_list_entries_user_id_idx" ON "public"."mal_user_list_entries" USING "btree" ("user_id");



CREATE INDEX "mal_watch_history_user_id_idx" ON "public"."mal_watch_history" USING "btree" ("user_id");



CREATE INDEX "mal_watch_history_watched_idx" ON "public"."mal_watch_history" USING "btree" ("watched_at" DESC);



CREATE INDEX "steam_accounts_user_id_idx" ON "public"."steam_accounts" USING "btree" ("user_id");



CREATE INDEX "steam_achievements_user_id_idx" ON "public"."steam_achievements" USING "btree" ("user_id");



CREATE INDEX "steam_ownership_last_played_idx" ON "public"."steam_ownership" USING "btree" ("last_played_at");



CREATE INDEX "steam_ownership_user_id_idx" ON "public"."steam_ownership" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "set_live_share_created_by" BEFORE INSERT ON "public"."live_share_rooms" FOR EACH ROW EXECUTE FUNCTION "public"."set_live_share_created_by"();



CREATE OR REPLACE TRIGGER "trg_clips_updated_at" BEFORE UPDATE ON "public"."clips" FOR EACH ROW EXECUTE FUNCTION "public"."clips_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_enforce_custom_data_object" BEFORE INSERT OR UPDATE ON "public"."monthly_status_sheets" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_custom_data_object"();



CREATE OR REPLACE TRIGGER "update_docker_compose_configs_updated_at" BEFORE UPDATE ON "public"."docker_compose_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_documents_updated_at" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_encrypted_vault_items_updated_at" BEFORE UPDATE ON "public"."encrypted_vault_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_infrastructure_secrets_updated_at" BEFORE UPDATE ON "public"."infrastructure_secrets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_items_updated_at" BEFORE UPDATE ON "public"."inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_monthly_status_sheets_updated_at" BEFORE UPDATE ON "public"."monthly_status_sheets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notes_updated_at" BEFORE UPDATE ON "public"."notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_configs_updated_at" BEFORE UPDATE ON "public"."user_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vault_config_updated_at" BEFORE UPDATE ON "public"."vault_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."clips"
    ADD CONSTRAINT "clips_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dashboard_layouts"
    ADD CONSTRAINT "dashboard_layouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."docker_compose_configs"
    ADD CONSTRAINT "docker_compose_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."encrypted_vault_items"
    ADD CONSTRAINT "encrypted_vault_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."infrastructure_secrets"
    ADD CONSTRAINT "infrastructure_secrets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_share_invites"
    ADD CONSTRAINT "live_share_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_share_invites"
    ADD CONSTRAINT "live_share_invites_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."live_share_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_share_participants"
    ADD CONSTRAINT "live_share_participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."live_share_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_share_participants"
    ADD CONSTRAINT "live_share_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."live_share_permissions"
    ADD CONSTRAINT "live_share_permissions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."live_share_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_share_rooms"
    ADD CONSTRAINT "live_share_rooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mal_accounts"
    ADD CONSTRAINT "mal_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mal_recommendations"
    ADD CONSTRAINT "mal_recommendations_mal_id_fkey" FOREIGN KEY ("mal_id") REFERENCES "public"."mal_anime"("mal_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mal_recommendations"
    ADD CONSTRAINT "mal_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mal_tokens"
    ADD CONSTRAINT "mal_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mal_user_list_entries"
    ADD CONSTRAINT "mal_user_list_entries_mal_id_fkey" FOREIGN KEY ("mal_id") REFERENCES "public"."mal_anime"("mal_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mal_user_list_entries"
    ADD CONSTRAINT "mal_user_list_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mal_watch_history"
    ADD CONSTRAINT "mal_watch_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monthly_status_sheets"
    ADD CONSTRAINT "monthly_status_sheets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."steam_accounts"
    ADD CONSTRAINT "steam_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."steam_achievements"
    ADD CONSTRAINT "steam_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."steam_game_stats"
    ADD CONSTRAINT "steam_game_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."steam_ownership"
    ADD CONSTRAINT "steam_ownership_appid_fkey" FOREIGN KEY ("appid") REFERENCES "public"."steam_games"("appid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."steam_ownership"
    ADD CONSTRAINT "steam_ownership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_configs"
    ADD CONSTRAINT "user_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vault_config"
    ADD CONSTRAINT "vault_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vault_sessions"
    ADD CONSTRAINT "vault_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anonymous access through RPC for public clips" ON "public"."clips" FOR SELECT TO "anon" USING (true);



CREATE POLICY "RPC functions can access clips for public sharing" ON "public"."clips" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can create their own Docker Compose configurations" ON "public"."docker_compose_configs" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can create their own documents" ON "public"."documents" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can create their own infrastructure secrets" ON "public"."infrastructure_secrets" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can create their own inventory items" ON "public"."inventory_items" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own locations" ON "public"."locations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own monthly status sheets" ON "public"."monthly_status_sheets" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can create their own notes" ON "public"."notes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own tasks" ON "public"."tasks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own vault config" ON "public"."vault_config" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can create their own vault items" ON "public"."encrypted_vault_items" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own Docker Compose configurations" ON "public"."docker_compose_configs" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own clips" ON "public"."clips" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own documents" ON "public"."documents" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own infrastructure secrets" ON "public"."infrastructure_secrets" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own inventory items" ON "public"."inventory_items" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own locations" ON "public"."locations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own monthly status sheets" ON "public"."monthly_status_sheets" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own notes" ON "public"."notes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own tasks" ON "public"."tasks" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own vault config" ON "public"."vault_config" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own vault items" ON "public"."encrypted_vault_items" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own clips" ON "public"."clips" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update their own Docker Compose configurations" ON "public"."docker_compose_configs" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own clips" ON "public"."clips" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("created_by" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own documents" ON "public"."documents" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own infrastructure secrets" ON "public"."infrastructure_secrets" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own inventory items" ON "public"."inventory_items" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own locations" ON "public"."locations" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own monthly status sheets" ON "public"."monthly_status_sheets" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own notes" ON "public"."notes" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update their own tasks" ON "public"."tasks" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own vault config" ON "public"."vault_config" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own vault items" ON "public"."encrypted_vault_items" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own Docker Compose configurations" ON "public"."docker_compose_configs" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own clips" ON "public"."clips" FOR SELECT TO "authenticated" USING (("created_by" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own documents" ON "public"."documents" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own infrastructure secrets" ON "public"."infrastructure_secrets" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own inventory items" ON "public"."inventory_items" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own locations" ON "public"."locations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own monthly status sheets" ON "public"."monthly_status_sheets" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own notes" ON "public"."notes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view their own tasks" ON "public"."tasks" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own vault config" ON "public"."vault_config" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own vault items" ON "public"."encrypted_vault_items" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."clips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dashboard_layouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete_own_focus_sessions" ON "public"."focus_sessions" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "delete_own_vault_sessions" ON "public"."vault_sessions" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."docker_compose_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."encrypted_vault_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."focus_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."infrastructure_secrets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_own_focus_sessions" ON "public"."focus_sessions" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "insert_own_layout" ON "public"."dashboard_layouts" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "insert_own_vault_sessions_future_expiry" ON "public"."vault_sessions" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("expires_at" > "timezone"('UTC'::"text", CURRENT_TIMESTAMP))));



ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."live_share_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "live_share_events_insert_anon" ON "public"."live_share_events" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "live_share_events_select_public" ON "public"."live_share_events" FOR SELECT USING (true);



ALTER TABLE "public"."live_share_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."live_share_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."live_share_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."live_share_rooms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "live_share_rooms_authenticated_insert" ON "public"."live_share_rooms" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "live_share_rooms_creator_delete" ON "public"."live_share_rooms" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "live_share_rooms_creator_update_locked" ON "public"."live_share_rooms" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "created_by")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "live_share_rooms_public_select" ON "public"."live_share_rooms" FOR SELECT USING (true);



ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lsi_insert_host" ON "public"."live_share_invites" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."live_share_rooms" "r"
  WHERE (("r"."id" = "live_share_invites"."room_id") AND ("r"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "lsi_select_public" ON "public"."live_share_invites" FOR SELECT USING (true);



CREATE POLICY "lsp_insert_guest" ON "public"."live_share_participants" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("role" = 'guest'::"text") AND ("status" = 'pending'::"text")));



CREATE POLICY "lsp_select_public" ON "public"."live_share_participants" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."live_share_rooms" "r"
  WHERE ("r"."id" = "live_share_participants"."room_id"))) AND (("status" = 'approved'::"text") OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."live_share_rooms" "r"
  WHERE (("r"."id" = "live_share_participants"."room_id") AND ("r"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))))));



CREATE POLICY "lsp_update_host" ON "public"."live_share_participants" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."live_share_rooms" "r"
  WHERE (("r"."id" = "live_share_participants"."room_id") AND ("r"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."live_share_rooms" "r"
  WHERE (("r"."id" = "live_share_participants"."room_id") AND ("r"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "lspm_crud_host" ON "public"."live_share_permissions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."live_share_rooms" "r"
  WHERE (("r"."id" = "live_share_permissions"."room_id") AND ("r"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."live_share_rooms" "r"
  WHERE (("r"."id" = "live_share_permissions"."room_id") AND ("r"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "lspm_select_participants" ON "public"."live_share_permissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."live_share_participants" "p"
  WHERE (("p"."room_id" = "live_share_permissions"."room_id") AND ("p"."status" = 'approved'::"text")))));



ALTER TABLE "public"."mal_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mal_accounts_own" ON "public"."mal_accounts" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."mal_anime" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mal_anime_select_authenticated" ON "public"."mal_anime" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "mal_entries_own" ON "public"."mal_user_list_entries" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "mal_history_own" ON "public"."mal_watch_history" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."mal_recommendations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mal_recs_own" ON "public"."mal_recommendations" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."mal_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mal_tokens_own" ON "public"."mal_tokens" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."mal_user_list_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mal_watch_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monthly_status_sheets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_own_focus_sessions" ON "public"."focus_sessions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "select_own_layout" ON "public"."dashboard_layouts" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "select_own_unexpired_vault_sessions" ON "public"."vault_sessions" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("expires_at" > "timezone"('UTC'::"text", CURRENT_TIMESTAMP))));



ALTER TABLE "public"."steam_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "steam_accounts_own" ON "public"."steam_accounts" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."steam_achievements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "steam_achievements_own" ON "public"."steam_achievements" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."steam_game_stats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "steam_game_stats_own" ON "public"."steam_game_stats" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."steam_games" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "steam_games_select_authenticated" ON "public"."steam_games" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



ALTER TABLE "public"."steam_ownership" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "steam_ownership_own" ON "public"."steam_ownership" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update_own_focus_sessions" ON "public"."focus_sessions" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "update_own_layout" ON "public"."dashboard_layouts" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "update_own_vault_sessions_future_expiry" ON "public"."vault_sessions" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("expires_at" > "timezone"('UTC'::"text", CURRENT_TIMESTAMP))));



ALTER TABLE "public"."user_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_configs_delete_own" ON "public"."user_configs" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_configs_insert_own" ON "public"."user_configs" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_configs_select_own" ON "public"."user_configs" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_configs_update_own" ON "public"."user_configs" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."vault_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vault_sessions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."cleanup_expired_vault_sessions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_vault_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_vault_sessions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clips_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."clips_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clips_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_docker_compose_config"("_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_docker_compose_config"("_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_docker_compose_config"("_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_infrastructure_secret"("_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_infrastructure_secret"("_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_infrastructure_secret"("_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."end_live_share"("_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."end_live_share"("_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."end_live_share"("_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_custom_data_object"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_custom_data_object"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_custom_data_object"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_clip"("_id" "text", "_proof" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_clip"("_id" "text", "_proof" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_clip"("_id" "text", "_proof" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_clip_meta"("_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_clip_meta"("_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_clip_meta"("_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_clip_one_time"("_id" "text", "_proof" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_clip_one_time"("_id" "text", "_proof" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_clip_one_time"("_id" "text", "_proof" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_docker_compose_config"("_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_docker_compose_config"("_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_docker_compose_config"("_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_infrastructure_secret"("_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_infrastructure_secret"("_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_infrastructure_secret"("_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_live_share_participant_status"("_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_live_share_participant_status"("_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_live_share_participant_status"("_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."list_docker_compose_configs"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_docker_compose_configs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_docker_compose_configs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."list_infrastructure_secret_keys"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_infrastructure_secret_keys"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_infrastructure_secret_keys"() TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_expired_live_shares"() TO "anon";
GRANT ALL ON FUNCTION "public"."purge_expired_live_shares"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_expired_live_shares"() TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_live_share_invite"("_code" "text", "_display_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_live_share_invite"("_code" "text", "_display_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_live_share_invite"("_code" "text", "_display_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_live_share_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_live_share_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_live_share_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_live_share_participant_status"("_participant_id" "uuid", "_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_live_share_participant_status"("_participant_id" "uuid", "_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_live_share_participant_status"("_participant_id" "uuid", "_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."store_docker_compose_config"("_name" "text", "_description" "text", "_compose_content" "text", "_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."store_docker_compose_config"("_name" "text", "_description" "text", "_compose_content" "text", "_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."store_docker_compose_config"("_name" "text", "_description" "text", "_compose_content" "text", "_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."store_infrastructure_secret"("_key" "text", "_encrypted_value" "text", "_iv" "text", "_auth_tag" "text", "_salt" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."store_infrastructure_secret"("_key" "text", "_encrypted_value" "text", "_iv" "text", "_auth_tag" "text", "_salt" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."store_infrastructure_secret"("_key" "text", "_encrypted_value" "text", "_iv" "text", "_auth_tag" "text", "_salt" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_clip"("_id" "text", "_content" "text", "_expires_at" timestamp with time zone, "_proof" "text", "_set_password_proof" "text", "_set_password_salt" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_clip"("_id" "text", "_content" "text", "_expires_at" timestamp with time zone, "_proof" "text", "_set_password_proof" "text", "_set_password_salt" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_clip"("_id" "text", "_content" "text", "_expires_at" timestamp with time zone, "_proof" "text", "_set_password_proof" "text", "_set_password_salt" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_clip"("_id" "text", "_content" "text", "_expires_at" timestamp with time zone, "_proof" "text", "_set_password_proof" "text", "_set_password_salt" "text", "_one_time_view" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_clip"("_id" "text", "_content" "text", "_expires_at" timestamp with time zone, "_proof" "text", "_set_password_proof" "text", "_set_password_salt" "text", "_one_time_view" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_clip"("_id" "text", "_content" "text", "_expires_at" timestamp with time zone, "_proof" "text", "_set_password_proof" "text", "_set_password_salt" "text", "_one_time_view" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_live_share_access"("_id" "text", "_proof" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_live_share_access"("_id" "text", "_proof" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_live_share_access"("_id" "text", "_proof" "text") TO "service_role";
























GRANT ALL ON TABLE "public"."clips" TO "authenticated";
GRANT ALL ON TABLE "public"."clips" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_layouts" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_layouts" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_layouts" TO "service_role";



GRANT ALL ON TABLE "public"."docker_compose_configs" TO "anon";
GRANT ALL ON TABLE "public"."docker_compose_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."docker_compose_configs" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."encrypted_vault_items" TO "anon";
GRANT ALL ON TABLE "public"."encrypted_vault_items" TO "authenticated";
GRANT ALL ON TABLE "public"."encrypted_vault_items" TO "service_role";



GRANT ALL ON TABLE "public"."focus_sessions" TO "anon";
GRANT ALL ON TABLE "public"."focus_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."focus_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."infrastructure_secrets" TO "anon";
GRANT ALL ON TABLE "public"."infrastructure_secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."infrastructure_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."live_share_events" TO "anon";
GRANT ALL ON TABLE "public"."live_share_events" TO "authenticated";
GRANT ALL ON TABLE "public"."live_share_events" TO "service_role";



GRANT ALL ON TABLE "public"."live_share_invites" TO "anon";
GRANT ALL ON TABLE "public"."live_share_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."live_share_invites" TO "service_role";



GRANT ALL ON TABLE "public"."live_share_participants" TO "anon";
GRANT ALL ON TABLE "public"."live_share_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."live_share_participants" TO "service_role";



GRANT ALL ON TABLE "public"."live_share_permissions" TO "anon";
GRANT ALL ON TABLE "public"."live_share_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."live_share_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."live_share_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."live_share_rooms" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."live_share_rooms" TO "anon";
GRANT SELECT("id") ON TABLE "public"."live_share_rooms" TO "authenticated";



GRANT SELECT("max_peers") ON TABLE "public"."live_share_rooms" TO "anon";
GRANT SELECT("max_peers") ON TABLE "public"."live_share_rooms" TO "authenticated";



GRANT SELECT("created_by") ON TABLE "public"."live_share_rooms" TO "anon";
GRANT SELECT("created_by") ON TABLE "public"."live_share_rooms" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."live_share_rooms" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."live_share_rooms" TO "authenticated";



GRANT SELECT("password_salt") ON TABLE "public"."live_share_rooms" TO "anon";
GRANT SELECT("password_salt") ON TABLE "public"."live_share_rooms" TO "authenticated";



GRANT SELECT("expires_at") ON TABLE "public"."live_share_rooms" TO "anon";
GRANT SELECT("expires_at") ON TABLE "public"."live_share_rooms" TO "authenticated";



GRANT SELECT("locked"),UPDATE("locked") ON TABLE "public"."live_share_rooms" TO "authenticated";
GRANT SELECT("locked") ON TABLE "public"."live_share_rooms" TO "anon";



GRANT ALL ON TABLE "public"."live_share_rooms_public" TO "anon";
GRANT ALL ON TABLE "public"."live_share_rooms_public" TO "authenticated";
GRANT ALL ON TABLE "public"."live_share_rooms_public" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."mal_accounts" TO "anon";
GRANT ALL ON TABLE "public"."mal_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."mal_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."mal_anime" TO "anon";
GRANT ALL ON TABLE "public"."mal_anime" TO "authenticated";
GRANT ALL ON TABLE "public"."mal_anime" TO "service_role";



GRANT ALL ON TABLE "public"."mal_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."mal_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."mal_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."mal_tokens" TO "anon";
GRANT ALL ON TABLE "public"."mal_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."mal_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."mal_user_list_entries" TO "anon";
GRANT ALL ON TABLE "public"."mal_user_list_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."mal_user_list_entries" TO "service_role";



GRANT ALL ON TABLE "public"."mal_watch_history" TO "anon";
GRANT ALL ON TABLE "public"."mal_watch_history" TO "authenticated";
GRANT ALL ON TABLE "public"."mal_watch_history" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_status_sheets" TO "anon";
GRANT ALL ON TABLE "public"."monthly_status_sheets" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_status_sheets" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."steam_accounts" TO "anon";
GRANT ALL ON TABLE "public"."steam_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."steam_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."steam_achievements" TO "anon";
GRANT ALL ON TABLE "public"."steam_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."steam_achievements" TO "service_role";



GRANT ALL ON TABLE "public"."steam_game_stats" TO "anon";
GRANT ALL ON TABLE "public"."steam_game_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."steam_game_stats" TO "service_role";



GRANT ALL ON TABLE "public"."steam_games" TO "anon";
GRANT ALL ON TABLE "public"."steam_games" TO "authenticated";
GRANT ALL ON TABLE "public"."steam_games" TO "service_role";



GRANT ALL ON TABLE "public"."steam_ownership" TO "anon";
GRANT ALL ON TABLE "public"."steam_ownership" TO "authenticated";
GRANT ALL ON TABLE "public"."steam_ownership" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."user_configs" TO "anon";
GRANT ALL ON TABLE "public"."user_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."user_configs" TO "service_role";



GRANT ALL ON TABLE "public"."vault_config" TO "anon";
GRANT ALL ON TABLE "public"."vault_config" TO "authenticated";
GRANT ALL ON TABLE "public"."vault_config" TO "service_role";



GRANT ALL ON TABLE "public"."vault_sessions" TO "anon";
GRANT ALL ON TABLE "public"."vault_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."vault_sessions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
