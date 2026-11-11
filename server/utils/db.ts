export const myDB = () => {
    if (import.meta.dev) {
        return useDatabase('mainDB_local')
    }

    return useDatabase('mainDB_cf')
}

export async function ensureTasksTable() {
    await myDB().exec(`
        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            due_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'todo',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `)
}

export type ReminderStatus = 'todo' | 'in_progress' | 'done'

export interface ReminderInput {
    title: string
    description: string
    dueAt: string
    status: ReminderStatus
}

export function validateReminderInput(input: unknown): ReminderInput {
    if (!input || typeof input !== 'object') {
        throw createError({ statusCode: 400, statusMessage: 'Invalid reminder data' })
    }

    const body = input as Record<string, unknown>
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const dueAt = typeof body.dueAt === 'string' ? body.dueAt : ''
    const status = body.status

    if (!title || title.length > 120) {
        throw createError({ statusCode: 400, statusMessage: 'Title must be between 1 and 120 characters' })
    }

    if (description.length > 500) {
        throw createError({ statusCode: 400, statusMessage: 'Description must be at most 500 characters' })
    }

    if (!dueAt || Number.isNaN(Date.parse(dueAt))) {
        throw createError({ statusCode: 400, statusMessage: 'A valid due date is required' })
    }

    if (status !== 'todo' && status !== 'in_progress' && status !== 'done') {
        throw createError({ statusCode: 400, statusMessage: 'Invalid reminder status' })
    }

    return { title, description, dueAt: new Date(dueAt).toISOString(), status }
}

export function getReminderId(event: H3Event) {
    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Reminder ID is required' })
    }
    return id
}

export function serializeReminder(row: unknown) {
    if (!row || typeof row !== 'object') {
        throw createError({ statusCode: 500, statusMessage: 'Invalid reminder record' })
    }

    const record = row as Record<string, unknown>
    if (typeof record.id !== 'string' || typeof record.title !== 'string' || typeof record.due_at !== 'string') {
        throw createError({ statusCode: 500, statusMessage: 'Invalid reminder record' })
    }

    const status = record.status
    if (status !== 'todo' && status !== 'in_progress' && status !== 'done') {
        throw createError({ statusCode: 500, statusMessage: 'Invalid reminder status in database' })
    }

    return {
        id: record.id,
        title: record.title,
        description: typeof record.description === 'string' ? record.description : '',
        due_at: record.due_at,
        status,
    }
}
