import { ensureTasksTable, getReminderId, handleTaskApiError, myDB } from '../../utils/db'

export default defineEventHandler(async (event) => {
    const id = getReminderId(event)
    try {
        await ensureTasksTable()

        const database = myDB()
        const existing = await database.prepare('SELECT id FROM reminders WHERE id = ?').get(id)
        if (!existing) {
            throw createError({ statusCode: 404, statusMessage: 'Reminder not found' })
        }

        await database.prepare('DELETE FROM reminders WHERE id = ?').run(id)
        setResponseStatus(event, 204)
        return null
    } catch (error) {
        handleTaskApiError('Delete reminder', error)
    }
})
