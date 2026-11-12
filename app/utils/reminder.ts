export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface Reminder {
    id: string
    title: string
    description: string
    due_at: string
    status: TaskStatus
}

export interface ReminderPayload {
    title: string
    description: string
    dueAt: string
    status: TaskStatus
}

export type DueTone = 'overdue' | 'soon' | 'later' | 'done'

export const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done']

export const STATUS_META: Record<TaskStatus, { label: string; short: string; icon: string; empty: string }> = {
    todo: { label: 'باید انجام بشه', short: 'در صف', icon: 'circle', empty: 'فعلاً کاری در صف نیست' },
    in_progress: { label: 'در حال انجام', short: 'در حال انجام', icon: 'bolt', empty: 'هنوز کاری شروع نشده' },
    done: { label: 'انجام شده', short: 'انجام شده', icon: 'check', empty: 'اولین موفقیتت اینجا میاد' },
}

const numberFormat = new Intl.NumberFormat('fa-IR')
/** عدد با ارقام فارسی */
export const faNum = (value: number) => numberFormat.format(value)

const dueFormat = new Intl.DateTimeFormat('fa-IR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
})
export const formatDue = (iso: string) => dueFormat.format(new Date(iso))

const dayFormat = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' })
export const formatDay = (time: number) => dayFormat.format(new Date(time))

/** زمان باقی‌مانده / تأخیر به‌صورت متن فارسی + «لحن» رنگ */
export function dueInfo(iso: string, status: TaskStatus, now: number): { text: string; tone: DueTone } {
    if (status === 'done') return { text: 'انجام شد', tone: 'done' }

    const delta = new Date(iso).getTime() - now
    const abs = Math.abs(delta)
    const days = Math.floor(abs / 86_400_000)
    const hours = Math.floor((abs % 86_400_000) / 3_600_000)
    const minutes = Math.floor((abs % 3_600_000) / 60_000)

    const span = days
        ? `${faNum(days)} روز${hours ? ` و ${faNum(hours)} ساعت` : ''}`
        : hours
          ? `${faNum(hours)} ساعت${minutes ? ` و ${faNum(minutes)} دقیقه` : ''}`
          : `${faNum(Math.max(minutes, 1))} دقیقه`

    if (delta < 0) return { text: `${span} تأخیر`, tone: 'overdue' }
    return { text: `${span} مانده`, tone: delta <= 86_400_000 ? 'soon' : 'later' }
}

const pad = (value: number) => String(value).padStart(2, '0')

/** مقدار مناسب input[type=datetime-local] (به وقت محلی) */
export function toLocalInput(value: string | number | Date) {
    const d = new Date(value)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** میان‌بُرهای انتخاب زمان */
export function quickPresets(base = new Date()) {
    const at = (offsetDays: number, hour: number) => {
        const d = new Date(base)
        d.setDate(d.getDate() + offsetDays)
        d.setHours(hour, 0, 0, 0)
        return d
    }

    const presets = [{ label: 'یک ساعت دیگر', value: toLocalInput(base.getTime() + 3_600_000) }]
    const tonight = at(0, 21)
    if (tonight.getTime() > base.getTime() + 15 * 60_000) presets.push({ label: 'امشب', value: toLocalInput(tonight) })
    presets.push({ label: 'فردا صبح', value: toLocalInput(at(1, 9)) })
    presets.push({ label: 'هفتهٔ بعد', value: toLocalInput(at(7, 9)) })
    return presets
}
