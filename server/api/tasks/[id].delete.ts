import { ensureSchema, fail, getReminderId, handleTaskApiError, myDB } from '../../utils/db'
import { requireUser } from '../../utils/telegram'

export default defineEventHandler(async (event) => {
    const user = await requireUser(event)
    const id = getReminderId(event)

    try {
        await ensureSchema()
        const db = myDB()

        const existing = await db.prepare('SELECT id FROM reminders WHERE id = ? AND user_id = ?').get(id, user.id)
        if (!existing) throw fail(404, 'Reminder not found', 'این یادآور پیدا نشد.')

        await db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(id, user.id)
        setResponseStatus(event, 204)
        return null
    } catch (error) {
        handleTaskApiError('Delete reminder', error)
    }
})
