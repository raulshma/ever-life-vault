import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))
dotenv.config({ path: envPath })

function numberFromEnv(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function splitCsv(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export const env = {
  PORT: numberFromEnv(process.env.PORT, 8787),
  HOST: process.env.HOST || '0.0.0.0',
  ALLOWED_ORIGINS: splitCsv(process.env.ALLOWED_ORIGINS),
  ALLOWED_TARGET_HOSTS: splitCsv(process.env.ALLOWED_TARGET_HOSTS),
  JELLYSEERR_BASE: process.env.JELLYSEERR_BASE,
  JELLYFIN_BASE: process.env.JELLYFIN_BASE,
  KARAKEEP_BASE: process.env.KARAKEEP_BASE,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  OAUTH_REDIRECT_BASE_URL: process.env.OAUTH_REDIRECT_BASE_URL || 'http://localhost:8080',
  OAUTH_REDIRECT_PATH: process.env.OAUTH_REDIRECT_PATH || '/feeds',
  REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,
  REDDIT_REDIRECT_URI: process.env.REDDIT_REDIRECT_URI,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  MS_CLIENT_ID: process.env.MS_CLIENT_ID,
  MS_CLIENT_SECRET: process.env.MS_CLIENT_SECRET,
  MS_REDIRECT_URI: process.env.MS_REDIRECT_URI,
} as const

export type Env = typeof env


