import { ensureSchema, handleTaskApiError, myDB, serializeReminder } from '../../utils/db'
import { requireUser } from '../../utils/telegram'

export default defineEventHandler(async (event) => {
    const user = await requireUser(event)
    try {
        await ensureSchema()
        const rows = await myDB()
            .prepare('SELECT id, title, description, due_at, status FROM reminders WHERE user_id = ? ORDER BY due_at ASC')
            .all(user.id)

        return (rows as unknown[]).map(serializeReminder)
    } catch (error) {
        handleTaskApiError('Read reminders', error)
    }
})
