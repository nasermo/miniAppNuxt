<script setup lang="ts">
import type { Reminder, ReminderPayload, TaskStatus } from '~/utils/reminder'
import { STATUS_META, STATUS_ORDER } from '~/utils/reminder'

const props = defineProps<{ open: boolean; task: Reminder | null; saving: boolean }>()
const emit = defineEmits<{ close: []; save: [payload: ReminderPayload] }>()

const form = reactive({ title: '', description: '', dueAt: '', status: 'todo' as TaskStatus })
const touched = ref(false)
const presets = ref<{ label: string; value: string }[]>([])
const titleInput = ref<HTMLInputElement | null>(null)

const STATUS_COLOR: Record<TaskStatus, string> = { todo: 'var(--cyan)', in_progress: 'var(--violet)', done: 'var(--lime)' }

const titleInvalid = computed(() => touched.value && !form.title.trim())
const dueInvalid = computed(() => touched.value && (!form.dueAt || Number.isNaN(Date.parse(form.dueAt))))

watch(
  () => props.open,
  (isOpen) => {
    if (import.meta.client) document.documentElement.style.overflow = isOpen ? 'hidden' : ''
    if (!isOpen) return

    touched.value = false
    presets.value = quickPresets()
    if (props.task) {
      Object.assign(form, {
        title: props.task.title,
        description: props.task.description,
        dueAt: toLocalInput(props.task.due_at),
        status: props.task.status,
      })
    } else {
      Object.assign(form, { title: '', description: '', dueAt: toLocalInput(Date.now() + 3_600_000), status: 'todo' })
      nextTick(() => titleInput.value?.focus())
    }
  },
)

onBeforeUnmount(() => {
  if (import.meta.client) document.documentElement.style.overflow = ''
})

function submit() {
  touched.value = true
  if (!form.title.trim() || !form.dueAt || Number.isNaN(Date.parse(form.dueAt))) return
  emit('save', {
    title: form.title.trim(),
    description: form.description.trim(),
    dueAt: new Date(form.dueAt).toISOString(),
    status: form.status,
  })
}
</script>

<template>
  <Transition name="sheet">
    <div v-if="open" class="sheet-root" @keydown.esc="emit('close')">
      <div class="sheet-backdrop" @click="emit('close')" />
      <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet__grip" />

        <header class="mb-4 flex items-center justify-between">
          <div>
            <p class="eyebrow">{{ task ? 'به‌روزرسانی' : 'یک قدم تازه' }}</p>
            <h2 id="sheet-title" class="mt-1 text-xl font-extrabold">{{ task ? 'ویرایش یادآور' : 'کار بعدی چیه؟' }}</h2>
          </div>
          <button class="icon-btn" type="button" aria-label="بستن" @click="emit('close')"><AppIcon name="x" :size="20" /></button>
        </header>

        <form class="grid gap-4" novalidate @submit.prevent="submit">
          <div>
            <label class="label" for="f-title">عنوان کار</label>
            <input
              id="f-title"
              ref="titleInput"
              v-model="form.title"
              class="field"
              :class="{ 'field--error': titleInvalid }"
              maxlength="120"
              placeholder="مثلاً: تماس با دکتر"
              autocomplete="off"
            />
            <p v-if="titleInvalid" class="mt-1 text-xs" style="color: rgb(var(--rose))">عنوان رو وارد کن.</p>
          </div>

          <div>
            <label class="label" for="f-desc">توضیحات <span style="color: var(--faint)">(اختیاری)</span></label>
            <textarea id="f-desc" v-model="form.description" class="field" style="resize: none" maxlength="500" rows="2" placeholder="چیزی هست که باید یادت بمونه؟" />
          </div>

          <div>
            <label class="label" for="f-due">زمان یادآوری</label>
            <input id="f-due" v-model="form.dueAt" class="field" :class="{ 'field--error': dueInvalid }" type="datetime-local" />
            <div class="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
              <button
                v-for="preset in presets"
                :key="preset.label"
                class="chip shrink-0"
                style="cursor: pointer"
                type="button"
                :class="{ 'chip--soon': form.dueAt === preset.value }"
                @click="form.dueAt = preset.value"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>

          <div>
            <span class="label">وضعیت</span>
            <div class="seg" role="group" aria-label="وضعیت">
              <button
                v-for="status in STATUS_ORDER"
                :key="status"
                class="seg__btn"
                type="button"
                :aria-pressed="form.status === status"
                :style="{ '--c': STATUS_COLOR[status] }"
                @click="form.status = status"
              >
                <AppIcon :name="STATUS_META[status].icon" :size="14" />{{ STATUS_META[status].short }}
              </button>
            </div>
          </div>

          <button class="btn btn--primary mt-1 w-full" style="padding-block: 14px" type="submit" :disabled="saving">
            <AppIcon v-if="saving" name="loader" :size="18" class="spin" />
            <template v-else><AppIcon name="check" :size="18" /></template>
            {{ saving ? 'در حال ذخیره...' : task ? 'ذخیره تغییرات' : 'ساخت یادآور' }}
          </button>
        </form>
      </section>
    </div>
  </Transition>
</template>
