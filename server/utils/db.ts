import type { H3Event } from 'h3'

/** نام binding دیتابیس D1 در wrangler.jsonc */
export const D1_BINDING = 'db_link'

export type ReminderStatus = 'todo' | 'in_progress' | 'done'

export interface ReminderInput {
    title: string
    description: string
    dueAt: string
    status: ReminderStatus
}

/** خطای استاندارد: statusMessage فقط ASCII (الزام HTTP)، متن فارسی در data.fa */
export function fail(statusCode: number, statusMessage: string, fa: string, detail?: string) {
    return createError({ statusCode, statusMessage, data: { fa, detail } })
}

/* -------------------------------------------------------------------------- */
/*  انتخاب دیتابیس                                                             */
/* -------------------------------------------------------------------------- */

function hasD1Binding() {
    const g = globalThis as any
    return Boolean(g.__env__?.[D1_BINDING] || g.__cf_env__?.[D1_BINDING])
}

/**
 * ❗ مشکل اصلی نسخهٔ قبل: انتخاب دیتابیس فقط با `import.meta.dev` انجام می‌شد.
 * یعنی هر چیزی که در `nuxt dev` (یا تونل dev) ثبت می‌شد در فایل SQLite محلی می‌رفت و
 * هرگز به Cloudflare D1 نمی‌رسید. حالا اگر binding واقعی D1 موجود باشد همیشه از آن
 * استفاده می‌شود و SQLite فقط وقتی که واقعاً در حالت توسعه‌ایم و binding نداریم.
 * در production اگر binding نباشد، به‌جای خطای مبهم، علت دقیق گزارش می‌شود.
 */
export function dbBackend(): 'd1' | 'sqlite' {
    if (hasD1Binding()) return 'd1'
    if (import.meta.dev) return 'sqlite'
    throw fail(
        500,
        'D1 binding is missing',
        'اتصال دیتابیس Cloudflare (db_link) پیدا نشد. مطمئن شو Worker با wrangler.jsonc همین پروژه دیپلوی شده.',
        `Binding "${D1_BINDING}" is not available in the Worker environment`,
    )
}

export const myDB = () => useDatabase(dbBackend() === 'd1' ? 'mainDB_cf' : 'mainDB_local')

/* -------------------------------------------------------------------------- */
/*  ساخت / مهاجرت جدول (فقط یک بار در هر isolate)                              */
/* -------------------------------------------------------------------------- */

const oneLine = (sql: string) => sql.replace(/\s+/g, ' ').trim()

let schemaPromise: Promise<void> | undefined

async function migrate() {
    const db = myDB()

    // D1 هر statement را باید تک‌خطی بگیرد
    await db.exec(oneLine(`
        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT 'guest',
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            due_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'todo',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `))

    // جدول نسخهٔ قبلی ستون user_id نداشت
    const columns = (await db.prepare('PRAGMA table_info(reminders)').all()) as { name: string }[]
    if (!columns.some((column) => column.name === 'user_id')) {
        try {
            await db.exec(`ALTER TABLE reminders ADD COLUMN user_id TEXT NOT NULL DEFAULT 'guest'`)
        } catch (error) {
            // اگر هم‌زمان یک isolate دیگر ستون را اضافه کرده باشد
            if (!String((error as Error)?.message ?? error).toLowerCase().includes('duplicate column')) throw error
        }
    }

    await db.exec('CREATE INDEX IF NOT EXISTS idx_reminders_user_due ON reminders (user_id, due_at)')
}

export function ensureSchema() {
    if (!schemaPromise) {
        schemaPromise = migrate().catch((error) => {
            schemaPromise = undefined // دفعهٔ بعد دوباره تلاش شود
            throw error
        })
    }
    return schemaPromise
}

/* -------------------------------------------------------------------------- */
/*  مدیریت خطا                                                                 */
/* -------------------------------------------------------------------------- */

export function handleTaskApiError(operation: string, error: unknown): never {
    if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        typeof (error as { statusCode: unknown }).statusCode === 'number' &&
        (error as { statusCode: number }).statusCode < 500
    ) {
        throw error
    }

    // خطای ساخته‌شده توسط خودمان (مثل نبودن binding) را دست‌نخورده برگردان
    if (error && typeof error === 'object' && 'statusMessage' in error && (error as any).data?.fa) {
        throw error
    }

    const detail = String((error as Error)?.message ?? error)
    console.error(`[api/tasks] ${operation} failed:`, error)
    throw fail(500, 'Database request failed', 'ارتباط با پایگاه داده برقرار نشد. لحظه‌ای بعد دوباره تلاش کن.', detail)
}

/* -------------------------------------------------------------------------- */
/*  اعتبارسنجی و سریالایز                                                      */
/* -------------------------------------------------------------------------- */

export function validateReminderInput(input: unknown): ReminderInput {
    if (!input || typeof input !== 'object') {
        throw fail(400, 'Invalid reminder data', 'اطلاعات یادآور معتبر نیست.')
    }

    const body = input as Record<string, unknown>
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const dueAt = typeof body.dueAt === 'string' ? body.dueAt : ''
    const status = body.status

    if (!title || title.length > 120) {
        throw fail(400, 'Title must be between 1 and 120 characters', 'عنوان باید بین ۱ تا ۱۲۰ کاراکتر باشد.')
    }
    if (description.length > 500) {
        throw fail(400, 'Description must be at most 500 characters', 'توضیحات حداکثر ۵۰۰ کاراکتر می‌تواند باشد.')
    }
    if (!dueAt || Number.isNaN(Date.parse(dueAt))) {
        throw fail(400, 'A valid due date is required', 'زمان یادآوری معتبر نیست.')
    }
    if (status !== 'todo' && status !== 'in_progress' && status !== 'done') {
        throw fail(400, 'Invalid reminder status', 'وضعیت یادآور معتبر نیست.')
    }

    return { title, description, dueAt: new Date(dueAt).toISOString(), status }
}

export function getReminderId(event: H3Event) {
    const id = getRouterParam(event, 'id')
    if (!id || id.length > 64) {
        throw fail(400, 'Reminder ID is required', 'شناسهٔ یادآور معتبر نیست.')
    }
    return id
}

export function serializeReminder(row: unknown) {
    if (!row || typeof row !== 'object') {
        throw fail(500, 'Invalid reminder record', 'رکورد یادآور نامعتبر است.')
    }

    const record = row as Record<string, unknown>
    if (typeof record.id !== 'string' || typeof record.title !== 'string' || typeof record.due_at !== 'string') {
        throw fail(500, 'Invalid reminder record', 'رکورد یادآور نامعتبر است.')
    }

    const status = record.status
    if (status !== 'todo' && status !== 'in_progress' && status !== 'done') {
        throw fail(500, 'Invalid reminder status in database', 'وضعیت ذخیره‌شده نامعتبر است.')
    }

    return {
        id: record.id,
        title: record.title,
        description: typeof record.description === 'string' ? record.description : '',
        due_at: record.due_at,
        status,
    }
}

export const MAX_REMINDERS_PER_USER = 500
