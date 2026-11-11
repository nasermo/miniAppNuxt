import { ensureTasksTable, handleTaskApiError, myDB, serializeReminder } from '../../utils/db'

export default defineEventHandler(async () => {
    try {
        await ensureTasksTable()
        const rows = await myDB().prepare(
            'SELECT id, title, description, due_at, status FROM reminders ORDER BY due_at ASC',
        ).all()

        return rows.map(serializeReminder)
    } catch (error) {
        handleTaskApiError('Read reminders', error)
    }
})
