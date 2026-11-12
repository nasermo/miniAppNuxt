import type { H3Event } from 'h3'
import { fail } from './db'

/** حداکثر عمر initData (ثانیه). تلگرام auth_date را هنگام باز شدن مینی‌اپ می‌سازد. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 3
const encoder = new TextEncoder()

export interface AppUser {
    /** شناسهٔ کاربر تلگرام (یا guest) */
    id: string
    /** true یعنی امضای initData با توکن بات تأیید شده */
    verified: boolean
}

async function hmacSha256(key: Uint8Array, message: string) {
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)))
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

function safeEqual(a: string, b: string) {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}

/** توکن بات را از secret/env می‌خواند (BOT_TOKEN یا NUXT_BOT_TOKEN) */
export function getBotToken(event: H3Event): string {
    const g = globalThis as any
    const cfEnv = g.__env__ ?? g.__cf_env__ ?? (event.context as any)?.cloudflare?.env ?? {}
    const proc = (g.process?.env ?? {}) as Record<string, string | undefined>
    let configured = ''
    try {
        configured = String((useRuntimeConfig(event) as any).botToken ?? '')
    } catch {
        /* ignore */
    }
    return String(cfEnv.BOT_TOKEN || cfEnv.NUXT_BOT_TOKEN || proc.BOT_TOKEN || proc.NUXT_BOT_TOKEN || configured || '').trim()
}

function parseTelegramUser(raw: string | null): { id: number } | null {
    if (!raw) return null
    try {
        const user = JSON.parse(raw)
        return user && typeof user.id === 'number' ? user : null
    } catch {
        return null
    }
}

/**
 * کاربر فعلی را از هدر `x-telegram-init-data` تشخیص می‌دهد.
 *  - اگر BOT_TOKEN تنظیم شده باشد: امضا و تازگی initData الزاماً بررسی می‌شود.
 *  - اگر تنظیم نشده باشد: شناسهٔ کاربر بدون تأیید پذیرفته می‌شود (فقط برای راه‌اندازی اولیه).
 *  - بدون initData (مرورگر معمولی): فقط در dev یا وقتی توکن نیست، به‌عنوان guest.
 */
export async function requireUser(event: H3Event): Promise<AppUser> {
    const raw = (getHeader(event, 'x-telegram-init-data') ?? '').trim()
    const botToken = getBotToken(event)
    const strict = Boolean(botToken) && !import.meta.dev

    if (!raw) {
        if (strict) throw fail(401, 'Telegram initData is required', 'این برنامه را از داخل تلگرام باز کن.')
        return { id: 'guest', verified: false }
    }

    const params = new URLSearchParams(raw)
    const user = parseTelegramUser(params.get('user'))
    if (!user) {
        if (strict) throw fail(401, 'Invalid Telegram initData', 'اطلاعات ورود تلگرام معتبر نیست.')
        return { id: 'guest', verified: false }
    }

    if (!botToken) {
        return { id: String(user.id), verified: false }
    }

    const hash = params.get('hash') ?? ''
    params.delete('hash')
    const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')

    const secret = await hmacSha256(encoder.encode('WebAppData'), botToken)
    const expected = toHex(await hmacSha256(secret, dataCheckString))

    if (!hash || !safeEqual(hash, expected)) {
        throw fail(401, 'Invalid Telegram initData signature', 'امضای اطلاعات تلگرام معتبر نیست.')
    }

    const authDate = Number(params.get('auth_date'))
    if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) {
        throw fail(401, 'Telegram initData expired', 'نشست تلگرام منقضی شده؛ برنامه را دوباره باز کن.')
    }

    return { id: String(user.id), verified: true }
}
