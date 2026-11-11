import { ensureTasksTable, myDB, validateReminderInput } from '../../utils/db'

export default defineEventHandler(async (event) => {
    const reminder = validateReminderInput(await readBody(event))
    await ensureTasksTable()

    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    await myDB().prepare(
        'INSERT INTO reminders (id, title, description, due_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, reminder.title, reminder.description, reminder.dueAt, reminder.status, now, now)

    setResponseStatus(event, 201)
    return { id, ...reminder, due_at: reminder.dueAt }
})
