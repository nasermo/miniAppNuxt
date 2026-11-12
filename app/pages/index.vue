<script setup lang="ts">
import type { Reminder, ReminderPayload, TaskStatus } from '~/utils/reminder'
import { STATUS_META, STATUS_ORDER } from '~/utils/reminder'

type Tab = 'overview' | 'board'

const tg = useTelegram()
const store = useReminders()
const { items, loading, error } = store

const tab = ref<Tab>('overview')
const now = ref(0) // روی کلاینت بعد از mount مقدار می‌گیرد (جلوگیری از اختلاف SSR)
const sheetOpen = ref(false)
const editing = ref<Reminder | null>(null)
const saving = ref(false)
const busyId = ref<string | null>(null)
const pendingDelete = ref<Reminder | null>(null)
const toast = ref('')

const slider = ref<HTMLElement | null>(null)
const activeSlide = ref(0)

let clock: ReturnType<typeof setInterval> | undefined
let toastTimer: ReturnType<typeof setTimeout> | undefined

const COLUMN_COLOR: Record<TaskStatus, string> = { todo: 'var(--cyan)', in_progress: 'var(--violet)', done: 'var(--lime)' }

/* ------------------------------ چرخهٔ حیات ------------------------------ */
function onVisible() {
  if (document.visibilityState === 'visible') {
    now.value = Date.now()
    store.load(true) // همگام‌سازی بی‌صدا هنگام برگشتن به برنامه
  }
}

onMounted(() => {
  tg.init()
  now.value = Date.now()
  clock = setInterval(() => (now.value = Date.now()), 30_000)
  document.addEventListener('visibilitychange', onVisible)
  store.load()
})

onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
  if (toastTimer) clearTimeout(toastTimer)
  document.removeEventListener('visibilitychange', onVisible)
})

/* ------------------------------- داده‌های مشتق -------------------------------- */
const byDue = (a: Reminder, b: Reminder) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()

const openTasks = computed(() => items.value.filter((t) => t.status !== 'done').sort(byDue))
const doneCount = computed(() => items.value.filter((t) => t.status === 'done').length)
const overdueCount = computed(() => openTasks.value.filter((t) => now.value && new Date(t.due_at).getTime() < now.value).length)
const soonCount = computed(
  () =>
    openTasks.value.filter((t) => {
      const due = new Date(t.due_at).getTime()
      return now.value && due >= now.value && due <= now.value + 86_400_000
    }).length,
)
const progress = computed(() => (items.value.length ? Math.round((doneCount.value / items.value.length) * 100) : 0))
const nextTask = computed(() => openTasks.value[0] ?? null)
const upcoming = computed(() => openTasks.value.slice(1, 4))
const columns = computed(() =>
  STATUS_ORDER.map((status) => ({
    status,
    meta: STATUS_META[status],
    tasks: items.value.filter((t) => t.status === status).sort(byDue),
  })),
)

const firstName = computed(() => tg.user.value?.first_name ?? '')
const greeting = computed(() => {
  const hour = now.value ? new Date(now.value).getHours() : 12
  if (hour < 5) return 'شب بخیر'
  if (hour < 12) return 'صبح بخیر'
  if (hour < 17) return 'ظهر بخیر'
  if (hour < 21) return 'عصر بخیر'
  return 'شب بخیر'
})
const dayLabel = computed(() => (now.value ? formatDay(now.value) : ''))
const heroLine = computed(() => {
  if (!items.value.length) return 'هنوز یادآوری نساخته‌ای؛ اولین کارت رو اضافه کن.'
  if (!openTasks.value.length) return 'همهٔ کارهات انجام شده. عالیه!'
  const parts = [`${faNum(openTasks.value.length)} کار باز`]
  if (overdueCount.value) parts.push(`${faNum(overdueCount.value)} عقب‌افتاده`)
  return parts.join(' · ')
})
const nextInfo = computed(() => (nextTask.value ? dueInfo(nextTask.value.due_at, nextTask.value.status, now.value) : null))

/* ------------------------------- اسلایدر ستون‌ها ------------------------------- */
function updateActiveSlide() {
  const el = slider.value
  if (!el) return
  const center = el.getBoundingClientRect().left + el.clientWidth / 2
  let best = 0
  let bestDistance = Infinity
  Array.from(el.children).forEach((child, index) => {
    const box = child.getBoundingClientRect()
    const distance = Math.abs(box.left + box.width / 2 - center)
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  activeSlide.value = best
}

function goToSlide(index: number) {
  activeSlide.value = index
  slider.value?.children[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
}

function switchTab(next: Tab) {
  if (tab.value === next) return
  tab.value = next
  tg.impact('soft')
}

/* ---------------------------------- عملیات ---------------------------------- */
function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

function openCreate() {
  editing.value = null
  sheetOpen.value = true
  tg.impact('light')
}

function openEdit(task: Reminder) {
  editing.value = task
  sheetOpen.value = true
}

async function onSave(payload: ReminderPayload) {
  saving.value = true
  const wasEditing = Boolean(editing.value)
  const ok = editing.value ? await store.update(editing.value.id, payload) : await store.create(payload)
  saving.value = false
  if (ok) {
    sheetOpen.value = false
    tg.notify('success')
    showToast(wasEditing ? 'تغییرات ذخیره شد' : 'یادآور ساخته شد')
  } else {
    tg.notify('error')
  }
}

async function onMove(task: Reminder, status: TaskStatus) {
  busyId.value = task.id
  const ok = await store.setStatus(task, status)
  busyId.value = null
  if (ok) {
    tg.notify(status === 'done' ? 'success' : 'warning')
    if (status === 'done') showToast('آفرین! یک کار تموم شد')
  } else {
    tg.notify('error')
  }
}

function askRemove(task: Reminder) {
  pendingDelete.value = task
  tg.impact('medium')
}

async function confirmRemove() {
  const task = pendingDelete.value
  if (!task) return
  busyId.value = task.id
  const ok = await store.remove(task)
  busyId.value = null
  pendingDelete.value = null
  if (ok) {
    tg.notify('success')
    showToast('یادآور حذف شد')
  } else {
    tg.notify('error')
  }
}
</script>

<template>
  <div class="shell" dir="rtl">
    <!-- نوار بالا -->
    <header class="topbar">
      <div class="wrap topbar__inner">
        <div class="flex items-center gap-3">
          <span class="logo"><AppIcon name="bolt" :size="19" :stroke="2" /></span>
          <span class="text-lg font-extrabold tracking-tight">یاد<span class="neon">نو</span></span>
        </div>
        <div class="flex items-center gap-3">
          <span class="chip" aria-live="polite">
            <span class="inline-block h-1.5 w-1.5 rounded-full" :style="{ background: error ? 'rgb(var(--rose))' : 'rgb(var(--lime))', boxShadow: error ? '0 0 8px rgb(var(--rose))' : '0 0 8px rgb(var(--lime))' }" />
            {{ error ? 'قطع' : 'همگام' }}
          </span>
          <span class="avatar" :title="firstName || 'مهمان'">{{ (firstName || 'ی').slice(0, 1) }}</span>
        </div>
      </div>
    </header>

    <main class="wrap content">
      <div v-if="error" class="banner rise mb-4" role="alert">
        <AppIcon name="alert" :size="18" class="mt-0.5 shrink-0" />
        <span class="flex-1">{{ error }}</span>
        <button class="btn btn--ghost btn--sm shrink-0" type="button" @click="store.load()">تلاش دوباره</button>
      </div>

      <!-- ============================ نمای کلی ============================ -->
      <section v-if="tab === 'overview'" class="grid gap-4">
        <div class="card card--glow rise flex items-center justify-between gap-4 p-5" style="--i: 0">
          <div class="min-w-0">
            <p class="eyebrow">{{ dayLabel || 'امروز' }}</p>
            <h1 class="mt-2 text-2xl font-extrabold leading-snug sm:text-3xl">
              {{ greeting }}<template v-if="firstName">، <span class="neon-grad">{{ firstName }}</span></template>
            </h1>
            <p class="muted mt-2 text-[13px] leading-relaxed">{{ heroLine }}</p>
          </div>
          <ProgressRing :value="progress" :size="116" :stroke="9">
            <div>
              <div class="text-xl font-extrabold">{{ faNum(progress) }}٪</div>
              <div class="muted text-[10px]">انجام‌شده</div>
            </div>
          </ProgressRing>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="card stat rise" style="--i: 1; --c: var(--cyan)">
            <span class="stat__icon"><AppIcon name="target" :size="16" /></span>
            <div class="stat__num">{{ faNum(openTasks.length) }}</div>
            <div class="stat__label">کار باز</div>
          </div>
          <div class="card stat rise" style="--i: 2; --c: var(--violet)">
            <span class="stat__icon"><AppIcon name="clock" :size="16" /></span>
            <div class="stat__num">{{ faNum(soonCount) }}</div>
            <div class="stat__label">تا ۲۴ ساعت آینده</div>
          </div>
          <div class="card stat rise" style="--i: 3" :style="{ '--c': overdueCount ? 'var(--rose)' : 'var(--lime)' }">
            <span class="stat__icon"><AppIcon :name="overdueCount ? 'alert' : 'check'" :size="16" /></span>
            <div class="stat__num">{{ faNum(overdueCount) }}</div>
            <div class="stat__label">عقب‌افتاده</div>
          </div>
        </div>

        <!-- کار بعدی -->
        <div v-if="loading && !items.length" class="skeleton" />
        <div v-else-if="nextTask && nextInfo" class="card rise p-5" style="--i: 4">
          <div class="flex items-center justify-between">
            <p class="eyebrow">کار بعدی</p>
            <span class="chip" :class="`chip--${nextInfo.tone}`">
              <AppIcon :name="nextInfo.tone === 'overdue' ? 'alert' : 'clock'" :size="12" />{{ nextInfo.text }}
            </span>
          </div>
          <h2 class="mt-3 text-lg font-extrabold leading-relaxed">{{ nextTask.title }}</h2>
          <p v-if="nextTask.description" class="muted mt-1 text-[13px] leading-relaxed" style="white-space: pre-wrap">{{ nextTask.description }}</p>
          <div class="muted mt-3 flex items-center gap-2 text-xs"><AppIcon name="calendar" :size="14" />{{ formatDue(nextTask.due_at) }}</div>
          <div class="mt-4 flex gap-2">
            <button class="btn btn--primary btn--sm flex-1" type="button" :disabled="busyId === nextTask.id" @click="onMove(nextTask, nextTask.status === 'todo' ? 'in_progress' : 'done')">
              <AppIcon :name="nextTask.status === 'todo' ? 'play' : 'check'" :size="15" />
              {{ nextTask.status === 'todo' ? 'شروع کار' : 'انجام شد' }}
            </button>
            <button class="btn btn--ghost btn--sm" type="button" @click="openEdit(nextTask)"><AppIcon name="pencil" :size="15" />ویرایش</button>
          </div>
        </div>
        <div v-else class="card rise p-6 text-center" style="--i: 4">
          <div class="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl" style="color: rgb(var(--cyan)); background: rgb(var(--cyan) / 0.08); border: 1px solid rgb(var(--cyan) / 0.3); box-shadow: 0 0 28px -6px rgb(var(--cyan) / 0.6)">
            <AppIcon name="sparkle" :size="22" />
          </div>
          <p class="font-bold">{{ items.length ? 'کار بازی نداری' : 'شروع کنیم؟' }}</p>
          <p class="muted mt-1 text-[13px]">{{ items.length ? 'همه‌چیز تحت کنترله.' : 'اولین یادآور رو بساز تا اینجا پر بشه.' }}</p>
          <button class="btn btn--primary btn--sm mt-4" type="button" @click="openCreate"><AppIcon name="plus" :size="16" />یادآور جدید</button>
        </div>

        <!-- در ادامه -->
        <div v-if="upcoming.length" class="card rise p-2" style="--i: 5">
          <div class="flex items-center justify-between px-3 pb-1 pt-3">
            <p class="eyebrow">در ادامه</p>
            <button class="muted flex items-center gap-1 text-xs" type="button" style="background: none; border: 0" @click="switchTab('board')">
              همه <AppIcon name="arrow" :size="14" />
            </button>
          </div>
          <button v-for="task in upcoming" :key="task.id" class="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-start transition hover:bg-white/5" type="button" style="background: none; border: 0; color: inherit" @click="openEdit(task)">
            <span class="min-w-0 truncate text-sm font-semibold">{{ task.title }}</span>
            <span class="muted shrink-0 text-[11px]">{{ formatDue(task.due_at) }}</span>
          </button>
        </div>
      </section>

      <!-- =============================== تابلو =============================== -->
      <section v-else class="grid gap-4">
        <div class="rise flex items-end justify-between" style="--i: 0">
          <div>
            <p class="eyebrow">مدیریت زمان</p>
            <h1 class="mt-2 text-2xl font-extrabold">تابلوی <span class="neon-grad">کارها</span></h1>
          </div>
          <span class="count">{{ faNum(items.length) }}</span>
        </div>

        <div class="seg rise md:hidden" style="--i: 1" role="tablist" aria-label="دسته‌بندی کارها">
          <button
            v-for="(column, index) in columns"
            :key="column.status"
            class="seg__btn"
            type="button"
            role="tab"
            :aria-pressed="activeSlide === index"
            :style="{ '--c': COLUMN_COLOR[column.status] }"
            @click="goToSlide(index)"
          >
            {{ column.meta.short }}
            <span class="count">{{ faNum(column.tasks.length) }}</span>
          </button>
        </div>

        <div ref="slider" class="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto md:grid md:grid-cols-3 md:overflow-visible" style="overscroll-behavior-x: contain" @scroll.passive="updateActiveSlide">
          <section v-for="(column, index) in columns" :key="column.status" class="column rise w-full shrink-0 snap-center md:w-auto" :class="`column--${column.status}`" :style="{ '--i': index + 1 }" :aria-label="column.meta.label">
            <header class="column__head">
              <span class="flex items-center gap-2 text-[13px] font-bold">
                <AppIcon :name="column.meta.icon" :size="16" />
                {{ column.meta.label }}
              </span>
              <span class="count">{{ faNum(column.tasks.length) }}</span>
            </header>

            <div class="grid content-start gap-3 pt-3">
              <template v-if="loading && !items.length">
                <div class="skeleton" />
                <div class="skeleton" style="height: 72px" />
              </template>
              <TaskCard v-for="task in column.tasks" :key="task.id" :task="task" :now="now" :busy="busyId === task.id" @edit="openEdit" @remove="askRemove" @move="onMove" />
              <div v-if="!loading && !column.tasks.length" class="empty">
                <AppIcon name="inbox" :size="26" />
                <p>{{ column.meta.empty }}</p>
                <button v-if="column.status === 'todo' && !items.length" class="btn btn--ghost btn--sm" type="button" @click="openCreate"><AppIcon name="plus" :size="14" />اولین یادآور</button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>

    <!-- نوار ناوبری -->
    <nav class="dock" aria-label="بخش‌های برنامه">
      <div class="dock__bar">
        <button class="dock__item" type="button" :aria-current="tab === 'overview' ? 'page' : undefined" @click="switchTab('overview')">
          <AppIcon name="home" :size="21" /><span>نمای کلی</span>
        </button>
        <button class="fab" type="button" aria-label="یادآور جدید" @click="openCreate"><AppIcon name="plus" :size="26" :stroke="2.4" /></button>
        <button class="dock__item" type="button" :aria-current="tab === 'board' ? 'page' : undefined" @click="switchTab('board')">
          <AppIcon name="board" :size="21" /><span>تابلو</span>
        </button>
      </div>
    </nav>

    <TaskSheet :open="sheetOpen" :task="editing" :saving="saving" @close="sheetOpen = false" @save="onSave" />

    <!-- تأیید حذف -->
    <Transition name="sheet">
      <div v-if="pendingDelete" class="sheet-root" @keydown.esc="pendingDelete = null">
        <div class="sheet-backdrop" @click="pendingDelete = null" />
        <section class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="del-title">
          <div class="sheet__grip" />
          <div class="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl" style="color: rgb(var(--rose)); background: rgb(var(--rose) / 0.09); border: 1px solid rgb(var(--rose) / 0.32); box-shadow: 0 0 28px -6px rgb(var(--rose) / 0.6)">
            <AppIcon name="trash" :size="22" />
          </div>
          <h2 id="del-title" class="text-center text-lg font-extrabold">حذف یادآور؟</h2>
          <p class="muted mt-2 text-center text-[13px] leading-relaxed">«{{ pendingDelete.title }}» برای همیشه حذف می‌شه.</p>
          <div class="mt-5 grid grid-cols-2 gap-3">
            <button class="btn btn--ghost" type="button" @click="pendingDelete = null">انصراف</button>
            <button class="btn btn--danger" type="button" :disabled="busyId === pendingDelete.id" @click="confirmRemove"><AppIcon name="trash" :size="16" />حذف</button>
          </div>
        </section>
      </div>
    </Transition>

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status" aria-live="polite">
        <span class="toast__body"><AppIcon name="check" :size="15" />{{ toast }}</span>
      </div>
    </Transition>
  </div>
</template>
