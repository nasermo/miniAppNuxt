import { ensureSchema, fail, getReminderId, handleTaskApiError, myDB, serializeReminder, validateReminderInput } from '../../utils/db'
import { requireUser } from '../../utils/telegram'

export default defineEventHandler(async (event) => {
    const user = await requireUser(event)
    const id = getReminderId(event)
    const reminder = validateReminderInput(await readBody(event))

    try {
        await ensureSchema()
        const db = myDB()

        const existing = await db.prepare('SELECT id FROM reminders WHERE id = ? AND user_id = ?').get(id, user.id)
        if (!existing) throw fail(404, 'Reminder not found', 'این یادآور پیدا نشد.')

        await db
            .prepare('UPDATE reminders SET title = ?, description = ?, due_at = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?')
            .run(reminder.title, reminder.description, reminder.dueAt, reminder.status, new Date().toISOString(), id, user.id)

        const updated = await db
            .prepare('SELECT id, title, description, due_at, status FROM reminders WHERE id = ? AND user_id = ?')
            .get(id, user.id)
        return serializeReminder(updated)
    } catch (error) {
        handleTaskApiError('Update reminder', error)
    }
})
