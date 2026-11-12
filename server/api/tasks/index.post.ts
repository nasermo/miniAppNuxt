import { MAX_REMINDERS_PER_USER, ensureSchema, fail, handleTaskApiError, myDB, validateReminderInput } from '../../utils/db'
import { requireUser } from '../../utils/telegram'

export default defineEventHandler(async (event) => {
    const user = await requireUser(event)
    const reminder = validateReminderInput(await readBody(event))

    try {
        await ensureSchema()
        const db = myDB()

        const count = (await db.prepare('SELECT COUNT(*) AS n FROM reminders WHERE user_id = ?').get(user.id)) as { n?: number } | null
        if (Number(count?.n ?? 0) >= MAX_REMINDERS_PER_USER) {
            throw fail(409, 'Reminder limit reached', 'به سقف تعداد یادآورها رسیده‌ای؛ چندتا را حذف کن.')
        }

        const now = new Date().toISOString()
        const id = crypto.randomUUID()
        await db
            .prepare(
                'INSERT INTO reminders (id, user_id, title, description, due_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            )
            .run(id, user.id, reminder.title, reminder.description, reminder.dueAt, reminder.status, now, now)

        setResponseStatus(event, 201)
        return { id, title: reminder.title, description: reminder.description, due_at: reminder.dueAt, status: reminder.status }
    } catch (error) {
        handleTaskApiError('Create reminder', error)
    }
})
