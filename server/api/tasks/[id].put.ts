import { ensureTasksTable, getReminderId, handleTaskApiError, myDB, serializeReminder, validateReminderInput } from '../../utils/db'

export default defineEventHandler(async (event) => {
    const id = getReminderId(event)
    const reminder = validateReminderInput(await readBody(event))
    try {
        await ensureTasksTable()

        const database = myDB()
        const existing = await database.prepare('SELECT id FROM reminders WHERE id = ?').get(id)
        if (!existing) {
            throw createError({ statusCode: 404, statusMessage: 'Reminder not found' })
        }

        await database.prepare(
            'UPDATE reminders SET title = ?, description = ?, due_at = ?, status = ?, updated_at = ? WHERE id = ?',
        ).run(reminder.title, reminder.description, reminder.dueAt, reminder.status, new Date().toISOString(), id)

        const updated = await database.prepare(
            'SELECT id, title, description, due_at, status FROM reminders WHERE id = ?',
        ).get(id)
        return serializeReminder(updated)
    } catch (error) {
        handleTaskApiError('Update reminder', error)
    }
})
