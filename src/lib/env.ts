import 'server-only'

/**
 * Read a required environment variable at call time (not at import time), so a
 * missing value fails the request that needs it rather than the whole build.
 */
function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`)
  }
  return value
}

export const env = {
  get supabaseUrl() {
    return required('SUPABASE_URL')
  },
  get supabaseServiceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY')
  },
  get sessionSecret() {
    return required('SESSION_SECRET')
  },
  get adminPassword() {
    return required('ADMIN_PASSWORD')
  },
}
