import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-side admin client using SUPABASE_SERVICE_ROLE_KEY (Never exposed to browser)
let adminClientInstance: SupabaseClient | null = null;

export function getSupabaseEnv() {
  let url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_API_URL ||
    process.env.SUPABASE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    process.env.SUPABASE_APIURL ||
    process.env.apiurl ||
    '';

  let anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.ANON_KEY ||
    process.env.NEXT_PUBLIC_ANON_KEY ||
    '';

  let serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SERVICE_ROLE_KEY ||
    process.env.SERVICE_ROLE ||
    '';

  // Fallback scan for differently named Supabase URL / service role env keys in Vercel
  if (!url || !anonKey || !serviceRoleKey) {
    for (const [k, rawVal] of Object.entries(process.env)) {
      const val = (rawVal || '').trim();
      if (!val) continue;
      if (!url && /supabase|api.?url/i.test(k) && /^https:\/\/.+\.supabase\.(co|in|net)/i.test(val)) {
        url = val;
      } else if (!anonKey && /anon/i.test(k) && val.length > 20) {
        anonKey = val;
      } else if (!serviceRoleKey && /service.?role/i.test(k) && val.length > 20) {
        serviceRoleKey = val;
      }
    }
  }

  // Strip accidental quotes, whitespace, or endpoint subpaths like /rest/v1 or /auth/v1
  let normalizedUrl = url.trim().replace(/^["']|["']$/g, '');
  let rawHadSubpath = false;
  if (normalizedUrl) {
    try {
      const parsed = new URL(normalizedUrl);
      rawHadSubpath = parsed.pathname !== '/' && parsed.pathname !== '';
      if (
        /\.supabase\.(co|in|net)$/i.test(parsed.hostname) ||
        /\/(rest|auth|storage|functions)\/v1/i.test(parsed.pathname)
      ) {
        normalizedUrl = parsed.origin;
      } else {
        normalizedUrl = normalizedUrl.replace(/\/+$/, '');
      }
    } catch {
      // leave normalizedUrl as trimmed string
    }
  }

  return {
    url: normalizedUrl,
    anonKey: anonKey.trim().replace(/^["']|["']$/g, ''),
    serviceRoleKey: serviceRoleKey.trim().replace(/^["']|["']$/g, ''),
    rawHadSubpath,
  };
}

export function getSupabaseAdmin(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseEnv();

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase server configuration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
    );
  }

  if (!adminClientInstance) {
    adminClientInstance = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClientInstance;
}

/**
 * Ephemeral auth client for password sign-in so user JWTs never mutate the singleton service-role admin client.
 */
export function createSupabaseAuthClient(preferServiceRole = false): SupabaseClient {
  const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
  const key = preferServiceRole ? (serviceRoleKey || anonKey) : (anonKey || serviceRoleKey);
  if (!url || !key) {
    throw new Error('Missing Supabase configuration for authentication client.');
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isSupabaseConfigured(): boolean {
  const { url, serviceRoleKey } = getSupabaseEnv();
  return Boolean(url && serviceRoleKey);
}

