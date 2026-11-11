<script setup lang="ts">
type TaskStatus = 'todo' | 'in_progress' | 'done'

interface Reminder {
    id: string
    title: string
    description: string
    due_at: string
    status: TaskStatus
}

const columns: { id: TaskStatus; title: string; english: string; icon: string }[] = [
    { id: 'todo', title: 'باید انجام بشه', english: 'UP NEXT', icon: '○' },
    { id: 'in_progress', title: 'در حال انجام', english: 'IN MOTION', icon: '◉' },
    { id: 'done', title: 'انجام شده', english: 'COMPLETED', icon: '✓' },
]

const { data: reminders, pending, error, refresh } = await useFetch<Reminder[]>('/api/tasks', {
    default: () => [],
})

const isDialogOpen = ref(false)
const editingId = ref<string | null>(null)
const activeTab = ref<'overview' | 'tasks'>('overview')
const activeFilter = ref<TaskStatus | 'all'>('all')
const activeSlide = ref(0)
const taskSlider = ref<HTMLElement | null>(null)
const saving = ref(false)
const deletingId = ref<string | null>(null)
const notice = ref('')
const currentTime = ref(Date.now())
const form = reactive({ title: '', description: '', dueAt: '', status: 'todo' as TaskStatus })
let clockInterval: ReturnType<typeof setInterval> | undefined

onMounted(() => {
    clockInterval = setInterval(() => {
        currentTime.value = Date.now()
    }, 60_000)
})

onBeforeUnmount(() => {
    if (clockInterval) clearInterval(clockInterval)
})

const allReminders = computed(() => reminders.value ?? [])
const completedCount = computed(() => allReminders.value.filter((task) => task.status === 'done').length)
const activeCount = computed(() => allReminders.value.filter((task) => task.status !== 'done').length)
const dueSoonCount = computed(() => allReminders.value.filter((task) => task.status !== 'done' && new Date(task.due_at).getTime() >= currentTime.value && new Date(task.due_at).getTime() <= currentTime.value + 24 * 60 * 60 * 1000).length)
const progress = computed(() => allReminders.value.length ? Math.round((completedCount.value / allReminders.value.length) * 100) : 0)

function getRequestErrorDetails(error: unknown) {
    if (!error || typeof error !== 'object') return ''

    const requestError = error as {
        data?: { statusMessage?: unknown; message?: unknown }
        statusCode?: unknown
        statusMessage?: unknown
        message?: unknown
    }
    const message = requestError.data?.statusMessage
        ?? requestError.data?.message
        ?? requestError.statusMessage
        ?? requestError.message
    const status = typeof requestError.statusCode === 'number' ? `HTTP ${requestError.statusCode}` : ''

    if (typeof message !== 'string' || !message.trim()) return status
    return status ? `${status}: ${message}` : message
}

function requestAlert(fallback: string, error: unknown) {
    const details = getRequestErrorDetails(error)
    return details ? `${fallback} (${details})` : fallback
}

function updateActiveSlide() {
    const slider = taskSlider.value
    if (!slider) return

    const sliderCenter = slider.getBoundingClientRect().left + slider.clientWidth / 2
    const slides = Array.from(slider.children)
    activeSlide.value = slides.reduce((closestIndex, slide, index) => {
        const bounds = slide.getBoundingClientRect()
        const distance = Math.abs(bounds.left + bounds.width / 2 - sliderCenter)
        const closestBounds = slides[closestIndex].getBoundingClientRect()
        const closestDistance = Math.abs(closestBounds.left + closestBounds.width / 2 - sliderCenter)
        return distance < closestDistance ? index : closestIndex
    }, 0)
}

function goToSlide(index: number) {
    taskSlider.value?.children[index]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
    })
}

function tasksFor(status: TaskStatus) {
    return allReminders.value
        .filter((task) => task.status === status && (activeFilter.value === 'all' || activeFilter.value === status))
        .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
}

function openCreate() {
    editingId.value = null
    Object.assign(form, { title: '', description: '', dueAt: defaultDueDate(), status: 'todo' })
    isDialogOpen.value = true
}

function openEdit(task: Reminder) {
    editingId.value = task.id
    Object.assign(form, {
        title: task.title,
        description: task.description,
        dueAt: toLocalDateTime(task.due_at),
        status: task.status,
    })
    isDialogOpen.value = true
}

function defaultDueDate() {
    const date = new Date(Date.now() + 60 * 60 * 1000)
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
    return date.toISOString().slice(0, 16)
}

function toLocalDateTime(value: string) {
    const date = new Date(value)
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
    return date.toISOString().slice(0, 16)
}

function formatDue(value: string) {
    return new Intl.DateTimeFormat('fa-IR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function countdown(value: string, status: TaskStatus) {
    if (status === 'done') return 'به پایان رسیده'
    const delta = new Date(value).getTime() - currentTime.value
    const absolute = Math.abs(delta)
    const days = Math.floor(absolute / 86_400_000)
    const hours = Math.floor((absolute % 86_400_000) / 3_600_000)
    const minutes = Math.floor((absolute % 3_600_000) / 60_000)
    const remaining = days ? `${days} روز و ${hours} ساعت` : hours ? `${hours} ساعت و ${minutes} دقیقه` : `${Math.max(minutes, 1)} دقیقه`
    return delta < 0 ? `${remaining} تأخیر` : `${remaining} مانده`
}

async function saveReminder() {
    if (!form.title.trim() || !form.dueAt) return
    saving.value = true
    notice.value = ''
    try {
        const payload = {
            title: form.title.trim(),
            description: form.description.trim(),
            dueAt: new Date(form.dueAt).toISOString(),
            status: form.status,
        }
        await $fetch(editingId.value ? `/api/tasks/${editingId.value}` : '/api/tasks', {
            method: editingId.value ? 'PUT' : 'POST',
            body: payload,
        })
        isDialogOpen.value = false
        await refresh()
    } catch (requestError) {
        notice.value = requestAlert('ذخیره یادآور انجام نشد. دوباره تلاش کن.', requestError)
    } finally {
        saving.value = false
    }
}

async function changeStatus(task: Reminder, status: TaskStatus) {
    try {
        await $fetch(`/api/tasks/${task.id}`, {
            method: 'PUT',
            body: { title: task.title, description: task.description, dueAt: task.due_at, status },
        })
        await refresh()
    } catch (requestError) {
        notice.value = requestAlert('تغییر وضعیت ذخیره نشد. دوباره تلاش کن.', requestError)
    }
}

async function removeReminder(task: Reminder) {
    if (!window.confirm(`یادآور «${task.title}» حذف شود؟`)) return
    deletingId.value = task.id
    try {
        await $fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
        await refresh()
    } catch (requestError) {
        notice.value = requestAlert('حذف یادآور انجام نشد. دوباره تلاش کن.', requestError)
    } finally {
        deletingId.value = null
    }
}
</script>

<template>
    <main class="relative h-[100dvh] overflow-hidden bg-gradient-to-br from-slate-950 via-[#10142b] to-[#1b1028] text-slate-100" dir="rtl">
        <div class="pointer-events-none absolute -left-40 top-32 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
        <div class="pointer-events-none absolute -right-32 top-1/2 h-96 w-96 rounded-full bg-purple-600/20 blur-[130px]" />
        <div class="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-rose-600/10 blur-[120px]" />

        <div class="relative mx-auto flex h-full w-[calc(100%-2rem)] max-w-6xl flex-col overflow-hidden pt-[env(safe-area-inset-top)] sm:w-[calc(100%-3rem)]">
            <header class="flex h-14 shrink-0 items-center justify-between border-b border-white/10 sm:h-16">
                <a class="flex items-center gap-3 text-white" href="/" aria-label="خانه یادآور">
                    <span class="grid h-10 w-10 rotate-[-8deg] place-items-center rounded-xl border border-blue-300/30 bg-gradient-to-br from-blue-400/20 to-purple-500/20 shadow-lg shadow-blue-950/30">
                        <span class="h-3 w-3 rounded-sm bg-gradient-to-br from-blue-300 to-purple-300 shadow-[0_0_16px_rgba(167,139,250,0.8)]" />
                    </span>
                    <span class="text-xl font-extrabold tracking-tight">یاد<span class="text-violet-300">نو</span></span>
                </a>
                <div class="flex items-center gap-3 sm:gap-5">
                    <span class="flex items-center gap-2 text-xs text-slate-300 sm:text-sm"><span class="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.9)]" /> فضای شخصی تو</span>
                    <button class="grid h-9 w-9 place-items-center rounded-full border border-purple-300/20 bg-purple-400/10 text-sm text-purple-200 transition hover:bg-purple-400/20" aria-label="حساب کاربری">ی</button>
                </div>
            </header>

            <nav class="flex shrink-0 gap-2 border-b border-white/10 py-2" aria-label="بخش‌های برنامه">
                <button class="rounded-xl px-4 py-2 text-xs font-medium transition sm:text-sm" :class="activeTab === 'overview' ? 'bg-blue-400/15 text-blue-100' : 'text-slate-400 hover:bg-white/5 hover:text-white'" :aria-current="activeTab === 'overview' ? 'page' : undefined" @click="activeTab = 'overview'">نمای کلی</button>
                <button class="rounded-xl px-4 py-2 text-xs font-medium transition sm:text-sm" :class="activeTab === 'tasks' ? 'bg-violet-400/15 text-violet-100' : 'text-slate-400 hover:bg-white/5 hover:text-white'" :aria-current="activeTab === 'tasks' ? 'page' : undefined" @click="activeTab = 'tasks'">مدیریت زمان <span class="mr-1 text-[10px] text-slate-400">{{ allReminders.length.toLocaleString('fa-IR') }}</span></button>
            </nav>

            <div class="min-h-0 flex-1 overflow-hidden">
            <section v-if="activeTab === 'overview'" class="flex h-full flex-col overflow-hidden py-5 sm:py-7">
            <div class="flex flex-col items-start justify-between gap-4 pb-5 sm:flex-row sm:items-end sm:pb-7">
                <div>
                    <p class="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-blue-200"><span class="h-px w-6 bg-gradient-to-l from-blue-400 to-purple-400" /> پنل یادآوری هوشمند</p>
                    <h1 class="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">کارهای مهمت، <span class="bg-gradient-to-l from-blue-300 via-purple-300 to-rose-300 bg-clip-text text-transparent">روی ریل.</span></h1>
                    <p class="mt-2 text-xs text-slate-400 sm:text-sm">ذهنت رو آزاد کن؛ کار بعدی رو به ما بسپار.</p>
                </div>
                <button class="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-l from-blue-500 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-950/50 transition hover:from-blue-400 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-300/60 sm:text-sm" @click="openCreate">
                    <span class="text-xl leading-none">+</span>
                    <span>یادآور جدید</span>
                </button>
            </div>

            <section class="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-3" aria-label="خلاصه کارها">
                <article class="rounded-2xl border border-blue-300/15 bg-gradient-to-br from-blue-500/15 to-indigo-500/5 p-4 shadow-xl shadow-slate-950/10 backdrop-blur-xl">
                    <div class="flex items-center justify-between text-sm text-slate-300"><span>کارهای باز</span><span class="text-lg text-blue-300">◷</span></div>
                    <div class="mt-2 text-2xl font-bold text-white">{{ activeCount.toLocaleString('fa-IR') }}<small class="mr-1 text-sm font-normal text-slate-400">کار</small></div>
                    <div class="mt-2 flex items-center gap-2 text-[10px] text-slate-400 sm:text-xs"><span class="h-1.5 w-1.5 rounded-full bg-rose-400" /> {{ dueSoonCount.toLocaleString('fa-IR') }} تا برای ۲۴ ساعت آینده</div>
                </article>
                <article class="rounded-2xl border border-purple-300/15 bg-gradient-to-br from-purple-500/15 to-fuchsia-500/5 p-4 shadow-xl shadow-slate-950/10 backdrop-blur-xl">
                    <div class="flex items-center justify-between text-sm text-slate-300"><span>به پایان رسیده</span><span class="text-lg text-purple-300">✓</span></div>
                    <div class="mt-2 text-2xl font-bold text-white">{{ completedCount.toLocaleString('fa-IR') }}<small class="mr-1 text-sm font-normal text-slate-400">کار</small></div>
                    <div class="mt-2 text-[10px] text-slate-400 sm:text-xs">قدم‌به‌قدم رو به جلو ✨</div>
                </article>
                <article class="col-span-2 rounded-2xl border border-rose-300/15 bg-gradient-to-br from-rose-500/10 to-purple-500/5 p-4 shadow-xl shadow-slate-950/10 backdrop-blur-xl lg:col-span-1">
                    <div class="flex items-center justify-between text-sm text-slate-300"><span>پیشرفت کلی</span><span class="text-lg text-rose-300">↗</span></div>
                    <div class="mt-3 flex items-center gap-4">
                        <progress class="h-2 w-full overflow-hidden rounded-full accent-violet-400" :value="progress" max="100" :aria-label="`پیشرفت ${progress} درصد`" />
                        <span class="min-w-12 text-left text-xl font-bold text-white">{{ progress.toLocaleString('fa-IR') }}٪</span>
                    </div>
                    <p class="mt-2 text-[10px] text-slate-400 sm:text-xs">هر قدم کوچیک مهمه</p>
                </article>
            </section>

            <div v-if="notice || error" class="mt-4 flex shrink-0 items-start gap-2 rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2.5 text-xs leading-relaxed text-rose-200" role="alert">
                <span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-400/15 font-bold text-rose-200" aria-hidden="true">!</span>
                <span>{{ notice || requestAlert('دریافت یادآورها با خطا روبه‌رو شد.', error) }}</span>
            </div>
            <button class="mt-5 flex w-full items-center justify-between rounded-2xl border border-violet-300/15 bg-violet-400/[0.06] p-4 text-right transition hover:border-violet-300/30 hover:bg-violet-400/10" @click="activeTab = 'tasks'">
                <span><span class="block text-sm font-semibold text-slate-100">تابلوی کارها</span><span class="mt-1 block text-xs text-slate-400">یادآورها را بر اساس وضعیت مدیریت کن</span></span>
                <span class="text-lg text-violet-200">←</span>
            </button>
            <footer class="mt-auto pt-5 text-center text-[10px] text-slate-500"><span class="text-violet-300">✳</span> با تمرکز روی کار بعدی، به هرچیزی می‌رسی.</footer>
            </section>

            <section v-else class="flex h-full min-h-0 flex-col py-3 sm:py-5">
                <div class="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                        <p class="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-violet-200"><span class="h-px w-6 bg-gradient-to-l from-purple-400 to-rose-400" /> مدیریت زمان</p>
                        <h2 class="text-xl font-bold text-white sm:text-2xl">تابلوی کارها <span class="mr-1 rounded-lg border border-violet-300/15 bg-violet-400/10 px-2 py-1 align-middle text-xs text-violet-200">{{ allReminders.length.toLocaleString('fa-IR') }}</span></h2>
                    </div>
                    <div class="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-lg" aria-label="فیلتر کارها">
                        <button class="whitespace-nowrap rounded-lg px-3 py-2 text-xs transition" :class="activeFilter === 'all' ? 'bg-blue-400/15 text-blue-100 shadow-inner shadow-blue-300/10' : 'text-slate-400 hover:text-white'" @click="activeFilter = 'all'">همه</button>
                        <button class="whitespace-nowrap rounded-lg px-3 py-2 text-xs transition" :class="activeFilter === 'todo' ? 'bg-blue-400/15 text-blue-100 shadow-inner shadow-blue-300/10' : 'text-slate-400 hover:text-white'" @click="activeFilter = 'todo'">در انتظار</button>
                        <button class="whitespace-nowrap rounded-lg px-3 py-2 text-xs transition" :class="activeFilter === 'in_progress' ? 'bg-blue-400/15 text-blue-100 shadow-inner shadow-blue-300/10' : 'text-slate-400 hover:text-white'" @click="activeFilter = 'in_progress'">در حال انجام</button>
                        <button class="whitespace-nowrap rounded-lg px-3 py-2 text-xs transition" :class="activeFilter === 'done' ? 'bg-blue-400/15 text-blue-100 shadow-inner shadow-blue-300/10' : 'text-slate-400 hover:text-white'" @click="activeFilter = 'done'">انجام شده</button>
                    </div>
                </div>

                <div v-if="notice || error" class="mb-3 flex shrink-0 items-start gap-2 rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-200" role="alert">
                    <span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-400/15 font-bold text-rose-200" aria-hidden="true">!</span>
                    <span>{{ notice || requestAlert('دریافت یادآورها با خطا روبه‌رو شد.', error) }}</span>
                </div>

                <div class="flex min-h-0 flex-1 flex-col">
                <div ref="taskSlider" class="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-hidden" aria-label="دسته‌بندی یادآورها" @scroll.passive="updateActiveSlide">
                    <article v-for="column in columns" :key="column.id" class="flex h-full w-full shrink-0 snap-center flex-col overflow-hidden rounded-2xl border p-3 backdrop-blur-xl md:w-auto" :class="column.id === 'todo' ? 'border-blue-300/15 bg-blue-400/[0.035]' : column.id === 'in_progress' ? 'border-purple-300/15 bg-purple-400/[0.035]' : 'border-rose-300/15 bg-rose-400/[0.035]'">
                        <header class="flex items-center justify-between border-b border-white/[0.08] px-1 pb-3">
                            <div class="flex items-center gap-2">
                                <span class="text-base text-violet-300">{{ column.icon }}</span>
                                <h3 class="text-xs font-semibold text-slate-200">{{ column.title }}</h3>
                                <span class="grid h-5 min-w-5 place-items-center rounded-md bg-white/[0.07] px-1 text-[10px] text-slate-300">{{ tasksFor(column.id).length.toLocaleString('fa-IR') }}</span>
                            </div>
                            <span class="font-sans text-[9px] tracking-widest text-slate-500">{{ column.english }}</span>
                        </header>
                        <div class="grid min-h-0 flex-1 content-start gap-2.5 overflow-y-auto overscroll-contain pt-3">
                            <div v-if="pending" class="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-center text-xs text-slate-400">در حال دریافت کارها...</div>
                            <article v-for="task in tasksFor(column.id)" :key="task.id" class="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.025] p-3.5 shadow-lg shadow-slate-950/10 transition duration-200 hover:-translate-y-0.5 hover:border-violet-300/25 hover:shadow-violet-950/20">
                                <div class="flex items-center justify-between">
                                    <span class="flex items-center gap-1.5 text-[10px] text-slate-400"><span class="h-1.5 w-1.5 rounded-full bg-violet-300" /> {{ column.title }}</span>
                                    <div class="flex gap-1">
                                        <button class="grid h-7 w-7 place-items-center rounded-lg border border-transparent text-slate-400 transition hover:border-blue-300/20 hover:bg-blue-400/10 hover:text-blue-200" aria-label="ویرایش یادآور" title="ویرایش" @click="openEdit(task)">
                                            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-.8L19.2 8a2.8 2.8 0 0 0-4-4L4 15.2 4 20Z" /></svg>
                                        </button>
                                        <button class="grid h-7 w-7 place-items-center rounded-lg border border-transparent text-slate-400 transition hover:border-rose-300/20 hover:bg-rose-400/10 hover:text-rose-200 disabled:opacity-50" aria-label="حذف یادآور" title="حذف" :disabled="deletingId === task.id" @click="removeReminder(task)">
                                            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                                        </button>
                                    </div>
                                </div>
                                <h4 class="mt-2 text-sm font-semibold leading-relaxed text-slate-100">{{ task.title }}</h4>
                                <p v-if="task.description" class="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-400">{{ task.description }}</p>
                                <div class="mt-3 flex items-center gap-2 text-[10px] text-slate-400"><span class="text-blue-300">◷</span><span>{{ formatDue(task.due_at) }}</span></div>
                                <div class="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2.5">
                                    <span class="text-[10px]" :class="{ 'text-rose-300': task.status !== 'done' && new Date(task.due_at).getTime() < currentTime, 'text-slate-400': task.status === 'done', 'text-blue-200': task.status !== 'done' && new Date(task.due_at).getTime() >= currentTime }">{{ countdown(task.due_at, task.status) }}</span>
                                    <select v-if="task.status !== 'done'" class="max-w-24 rounded-md border border-white/10 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-300 outline-none focus:border-violet-300/40" :value="task.status" aria-label="تغییر وضعیت" @change="changeStatus(task, ($event.target as HTMLSelectElement).value as TaskStatus)">
                                        <option value="todo">در انتظار</option>
                                        <option value="in_progress">شروع کار</option>
                                        <option value="done">انجام شد</option>
                                    </select>
                                    <button v-else class="rounded-md border border-purple-300/15 bg-purple-400/10 px-2 py-1 text-[10px] text-purple-200 transition hover:bg-purple-400/20" @click="changeStatus(task, 'todo')">بازگردانی</button>
                                </div>
                            </article>
                            <div v-if="!pending && tasksFor(column.id).length === 0" class="flex min-h-32 flex-col items-center justify-center text-center text-slate-500">
                                <span class="text-xl text-slate-400">{{ column.icon }}</span>
                                <p class="mt-2 text-xs">{{ column.id === 'todo' ? 'فعلاً کاری در صف نیست' : column.id === 'in_progress' ? 'هنوز کاری شروع نشده' : 'اولین کارت موفقیتت اینجا میاد' }}</p>
                                <button v-if="column.id === 'todo' && allReminders.length === 0" class="mt-3 text-xs text-blue-200 transition hover:text-purple-200" @click="openCreate">اولین یادآور رو بساز <span class="text-sm">←</span></button>
                            </div>
                        </div>
                    </article>
                </div>
                <div class="flex shrink-0 items-center justify-center gap-2.5 py-3 md:hidden" role="group" aria-label="انتخاب ستون کارها">
                    <button v-for="(column, index) in columns" :key="column.id" class="h-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-300/60" :class="activeSlide === index ? 'w-5 bg-violet-300' : 'w-2 bg-slate-500/60 hover:bg-slate-300/80'" :aria-label="`نمایش ستون ${column.title}`" :aria-current="activeSlide === index ? 'true' : undefined" @click="goToSlide(index)" />
                </div>
                </div>
            </section>
            </div>
        </div>

        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="scale-95 opacity-0"
            enter-to-class="scale-100 opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="scale-100 opacity-100"
            leave-to-class="scale-95 opacity-0"
        >
            <div v-if="isDialogOpen" class="fixed inset-0 z-10 grid place-items-center overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-md" @click.self="isDialogOpen = false" @keydown.esc="isDialogOpen = false">
                <section class="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-violet-300/20 bg-gradient-to-br from-[#171b36]/95 via-[#17152d]/95 to-[#24142d]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:p-6" role="dialog" aria-modal="true" :aria-labelledby="'modal-title'">
                    <div class="mb-3 flex items-center justify-between">
                        <div class="grid h-9 w-9 place-items-center rounded-xl border border-violet-300/20 bg-violet-400/10 text-base text-violet-200">✳</div>
                        <button class="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-xl leading-none text-slate-300 transition hover:bg-rose-400/10 hover:text-rose-200" aria-label="بستن" @click="isDialogOpen = false">×</button>
                    </div>
                    <p class="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-violet-200"><span class="h-px w-6 bg-gradient-to-l from-purple-400 to-rose-400" /> {{ editingId ? 'به‌روزرسانی' : 'یک قدم تازه' }}</p>
                    <h2 id="modal-title" class="text-xl font-bold text-white">{{ editingId ? 'ویرایش یادآور' : 'کار بعدی چیه؟' }}</h2>
                    <p class="mb-3 mt-1 text-[11px] text-slate-400">جزئیاتش رو وارد کن تا با خیال راحت بسپریش به ما.</p>
                    <form class="grid gap-3" @submit.prevent="saveReminder">
                        <label class="grid min-w-0 gap-1.5 text-xs text-slate-300"><span>عنوان کار <span class="text-rose-300">*</span></span><input v-model="form.title" class="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/50 focus:ring-2 focus:ring-violet-400/10" required maxlength="120" placeholder="مثلاً: تماس با دکتر" autofocus></label>
                        <label class="grid min-w-0 gap-1.5 text-xs text-slate-300"><span>توضیحات</span><textarea v-model="form.description" class="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/50 focus:ring-2 focus:ring-violet-400/10" maxlength="500" rows="2" placeholder="چیزی هست که باید یادت بمونه؟"></textarea></label>
                        <div class="grid grid-cols-2 gap-2.5">
                            <label class="grid min-w-0 gap-1.5 text-[11px] text-slate-300"><span>زمان یادآوری <span class="text-rose-300">*</span></span><input v-model="form.dueAt" class="min-w-0 w-full rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5 text-[11px] text-white outline-none transition focus:border-violet-300/50 focus:ring-2 focus:ring-violet-400/10 sm:px-3 sm:text-sm" type="datetime-local" required></label>
                            <label class="grid min-w-0 gap-1.5 text-[11px] text-slate-300"><span>وضعیت</span><select v-model="form.status" class="min-w-0 w-full rounded-xl border border-white/10 bg-slate-900/80 px-2 py-2.5 text-xs text-white outline-none transition focus:border-violet-300/50 focus:ring-2 focus:ring-violet-400/10"><option value="todo">در انتظار</option><option value="in_progress">در حال انجام</option><option value="done">انجام شده</option></select></label>
                        </div>
                        <button class="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-blue-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:from-blue-400 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-300/60 disabled:cursor-wait disabled:opacity-60" type="submit" :disabled="saving">
                            <span>{{ saving ? 'در حال ذخیره...' : editingId ? 'ذخیره تغییرات' : 'ساخت یادآور' }}</span><span v-if="!saving">←</span>
                        </button>
                    </form>
                </section>
            </div>
        </Transition>
    </main>
</template>
