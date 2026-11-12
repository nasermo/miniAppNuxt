import type { Reminder, ReminderPayload, TaskStatus } from '~/utils/reminder'

/** پیام خطای قابل‌نمایش به کاربر از پاسخ API */
export function describeError(error: unknown, fallback: string) {
    const e = error as {
        statusCode?: number
        statusMessage?: string
        message?: string
        data?: { statusMessage?: string; message?: string; data?: { fa?: string; detail?: string } }
    }

    const fa = e?.data?.data?.fa
    const detail = e?.data?.data?.detail

    if (!e?.statusCode) return 'اتصال برقرار نشد. اینترنتت رو بررسی کن.'
    const status = `HTTP ${e.statusCode}`

    if (fa) return detail ? `${fa} (${status}: ${detail})` : fa

    const raw = e?.data?.statusMessage ?? e?.data?.message ?? e?.statusMessage ?? e?.message
    return `${fallback}${raw ? ` (${status}: ${raw})` : ` (${status})`}`
}

export function useReminders() {
    const { initData } = useTelegram()

    const items = ref<Reminder[]>([])
    const loading = ref(true)
    const error = ref('')

    /** هر درخواست، initData تلگرام را برای تشخیص کاربر همراه دارد */
    function call<T>(url: string, options: Record<string, any> = {}) {
        return $fetch<T>(url, {
            ...options,
            headers: { ...(options.headers ?? {}), 'x-telegram-init-data': initData() },
        })
    }

    async function load(silent = false) {
        if (!silent) loading.value = true
        try {
            items.value = await call<Reminder[]>('/api/tasks')
            error.value = ''
        } catch (e) {
            if (!silent || !items.value.length) error.value = describeError(e, 'دریافت یادآورها انجام نشد.')
        } finally {
            loading.value = false
        }
    }

    async function create(payload: ReminderPayload) {
        try {
            const created = await call<Reminder>('/api/tasks', { method: 'POST', body: payload })
            items.value = [...items.value, created]
            error.value = ''
            return true
        } catch (e) {
            error.value = describeError(e, 'ذخیرهٔ یادآور انجام نشد.')
            return false
        }
    }

    async function update(id: string, payload: ReminderPayload) {
        try {
            const updated = await call<Reminder>(`/api/tasks/${id}`, { method: 'PUT', body: payload })
            items.value = items.value.map((task) => (task.id === id ? updated : task))
            error.value = ''
            return true
        } catch (e) {
            error.value = describeError(e, 'ذخیرهٔ تغییرات انجام نشد.')
            return false
        }
    }

    /** تغییر وضعیت با به‌روزرسانی خوش‌بینانه؛ در صورت خطا برمی‌گردد */
    async function setStatus(task: Reminder, status: TaskStatus) {
        const previous = items.value
        items.value = previous.map((item) => (item.id === task.id ? { ...item, status } : item))
        try {
            const updated = await call<Reminder>(`/api/tasks/${task.id}`, {
                method: 'PUT',
                body: { title: task.title, description: task.description, dueAt: task.due_at, status },
            })
            items.value = items.value.map((item) => (item.id === task.id ? updated : item))
            error.value = ''
            return true
        } catch (e) {
            items.value = previous
            error.value = describeError(e, 'تغییر وضعیت ذخیره نشد.')
            return false
        }
    }

    async function remove(task: Reminder) {
        try {
            await call(`/api/tasks/${task.id}`, { method: 'DELETE' })
            items.value = items.value.filter((item) => item.id !== task.id)
            error.value = ''
            return true
        } catch (e) {
            error.value = describeError(e, 'حذف یادآور انجام نشد.')
            return false
        }
    }

    return { items, loading, error, load, create, update, setStatus, remove }
}
