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
  ALLOW_UNAUTH_AGP: ['1', 'true', 'yes'].includes(String(process.env.ALLOW_UNAUTH_AGP || '').toLowerCase()),
  JELLYSEERR_BASE: process.env.JELLYSEERR_BASE,
  JELLYFIN_BASE: process.env.JELLYFIN_BASE,
  KARAKEEP_BASE: process.env.KARAKEEP_BASE,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
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
  YT_CLIENT_ID: process.env.YT_CLIENT_ID,
  YT_CLIENT_SECRET: process.env.YT_CLIENT_SECRET,
  YT_REDIRECT_URI: process.env.YT_REDIRECT_URI,
  YTM_CLIENT_ID: process.env.YTM_CLIENT_ID,
  YTM_CLIENT_SECRET: process.env.YTM_CLIENT_SECRET,
  YTM_REDIRECT_URI: process.env.YTM_REDIRECT_URI,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI,
  // Steam
  STEAM_WEB_API_KEY: process.env.STEAM_WEB_API_KEY,
  // MyAnimeList
  MAL_CLIENT_ID: process.env.MAL_CLIENT_ID,
  MAL_CLIENT_SECRET: process.env.MAL_CLIENT_SECRET,
  MAL_REDIRECT_URI: process.env.MAL_REDIRECT_URI,
  MAL_TOKENS_SECRET: process.env.MAL_TOKENS_SECRET,
  // Cloudflare Turnstile
  TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  // OpenRouter API
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
} as const

export type Env = typeof env


