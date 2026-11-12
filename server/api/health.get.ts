import { dbBackend, ensureSchema, handleTaskApiError, myDB } from '../utils/db'
import { getBotToken } from '../utils/telegram'

/**
 * بررسی سلامت اتصال: بعد از دیپلوی آدرس  https://<your-worker>/api/health  را در مرورگر باز کن.
 * backend باید "d1" باشد. اگر "sqlite" یا خطا دیدی یعنی داده به Cloudflare نمی‌رسد.
 */
export default defineEventHandler(async (event) => {
    try {
        const backend = dbBackend()
        await ensureSchema()
        await myDB().prepare('SELECT 1 AS ok').get()
        return {
            ok: true,
            backend,
            schema: 'ready',
            telegramAuth: getBotToken(event) ? 'verified' : 'unverified (BOT_TOKEN not set)',
        }
    } catch (error) {
        handleTaskApiError('Health check', error)
    }
})
