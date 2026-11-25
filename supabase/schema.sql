-- ============================================================================
-- UpdatePilot - Supabase PostgreSQL Schema & Row-Level Security (RLS)
-- Supports Supabase Auth (auth.users), profiles, devices, applications,
-- scans, updates, jobs, audit_logs, settings, and agent credentials.
-- ============================================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES TABLE (Linked directly to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger to auto-create profile on auth.users sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'USER')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, public.profiles.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. USER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system',
  scan_interval_hours INTEGER NOT NULL DEFAULT 12,
  auto_check_updates BOOLEAN NOT NULL DEFAULT true,
  email_alerts BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. DEVICES TABLE
CREATE TABLE IF NOT EXISTS public.devices (
  id TEXT PRIMARY KEY DEFAULT ('dev_' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  os_version TEXT NOT NULL,
  os_build TEXT,
  agent_version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'ONLINE', -- ONLINE, OFFLINE, REVOKED
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  pairing_code TEXT,
  pairing_code_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_pairing_code ON public.devices(pairing_code);
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices(status);

-- 4. AGENT CREDENTIALS TABLE (Tokens for Windows Agent service)
CREATE TABLE IF NOT EXISTS public.agent_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_agent_creds_device ON public.agent_credentials(device_id);

-- 5. APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.applications (
  id TEXT PRIMARY KEY DEFAULT ('app_' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))),
  device_id TEXT NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  package_id TEXT,
  publisher TEXT,
  installed_version TEXT NOT NULL,
  available_version TEXT,
  source TEXT DEFAULT 'winget',
  status TEXT NOT NULL DEFAULT 'UP_TO_DATE', -- UP_TO_DATE, UPDATE_AVAILABLE, UNKNOWN_VERSION, UNSUPPORTED, UNMATCHED
  last_scanned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_device_app UNIQUE (device_id, name, installed_version)
);
CREATE INDEX IF NOT EXISTS idx_applications_device_status ON public.applications(device_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_package_id ON public.applications(package_id);

-- 6. SCANS TABLE (Scan history & discovery jobs)
CREATE TABLE IF NOT EXISTS public.scans (
  id TEXT PRIMARY KEY DEFAULT ('scan_' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))),
  device_id TEXT NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, RUNNING, COMPLETED, FAILED
  error_details TEXT,
  apps_discovered INTEGER DEFAULT 0,
  updates_discovered INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_scans_device ON public.scans(device_id);

-- 7. UPDATES TABLE (Application version change history)
CREATE TABLE IF NOT EXISTS public.updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id TEXT NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  previous_version TEXT NOT NULL,
  new_version TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'UPDATE',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_updates_application ON public.updates(application_id);

-- 8. JOBS TABLE (Update & dispatch jobs for Windows agent)
CREATE TABLE IF NOT EXISTS public.jobs (
  id TEXT PRIMARY KEY DEFAULT ('job_' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))),
  device_id TEXT NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'UPDATE', -- UPDATE or SCAN
  package_id TEXT NOT NULL,
  current_version TEXT NOT NULL,
  target_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, CLAIMED, RUNNING, VERIFYING, COMPLETED, FAILED, RESTART_REQUIRED
  execution_output TEXT,
  verification_details TEXT,
  exit_code INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_jobs_device_status ON public.jobs(device_id, status);

-- 9. AUDIT_LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  device_id TEXT REFERENCES public.devices(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_device ON public.audit_logs(device_id);

-- 10. RELEASE METADATA TABLE (Catalog cache)
CREATE TABLE IF NOT EXISTS public.release_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id TEXT NOT NULL UNIQUE,
  latest_version TEXT NOT NULL,
  publisher_url TEXT,
  release_notes_url TEXT,
  license TEXT,
  installer_type TEXT,
  sha256 TEXT,
  release_date TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_release_metadata_package ON public.release_metadata(package_id);

-- 11. SECURITY FINDINGS TABLE (Catalog advisories)
CREATE TABLE IF NOT EXISTS public.security_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id TEXT NOT NULL,
  cve_id TEXT NOT NULL,
  severity TEXT NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
  description TEXT NOT NULL,
  affected_versions TEXT NOT NULL,
  fixed_in_version TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_security_findings_package ON public.security_findings(package_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_findings ENABLE ROW LEVEL SECURITY;

-- PROFILES RLS
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- SETTINGS RLS
CREATE POLICY "Users can view own settings"
  ON public.settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can modify own settings"
  ON public.settings FOR ALL
  USING (auth.uid() = user_id);

-- DEVICES RLS
CREATE POLICY "Users can view own devices"
  ON public.devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own devices"
  ON public.devices FOR ALL
  USING (auth.uid() = user_id);

-- APPLICATIONS RLS (Device ownership check)
CREATE POLICY "Users can view applications on their devices"
  ON public.applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = applications.device_id
        AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update applications on their devices"
  ON public.applications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = applications.device_id
        AND devices.user_id = auth.uid()
    )
  );

-- SCANS RLS
CREATE POLICY "Users can view scans on their devices"
  ON public.scans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = scans.device_id
        AND devices.user_id = auth.uid()
    )
  );

-- UPDATES RLS
CREATE POLICY "Users can view updates on their applications"
  ON public.updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications
      JOIN public.devices ON devices.id = applications.device_id
      WHERE applications.id = updates.application_id
        AND devices.user_id = auth.uid()
    )
  );

-- JOBS RLS
CREATE POLICY "Users can view jobs on their devices"
  ON public.jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = jobs.device_id
        AND devices.user_id = auth.uid()
    )
  );

-- AUDIT LOGS RLS
CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- CATALOG TABLES (Read-only for all authenticated users)
CREATE POLICY "Authenticated users can view release metadata"
  ON public.release_metadata FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view security findings"
  ON public.security_findings FOR SELECT
  TO authenticated
  USING (true);

-- SERVICE ROLE BYPASS:
-- Supabase automatically grants full bypass to requests authenticated with
-- SUPABASE_SERVICE_ROLE_KEY (used by Next.js Server routes for Windows Agent API).

