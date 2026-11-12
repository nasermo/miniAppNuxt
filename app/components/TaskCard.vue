<script setup lang="ts">
import type { Reminder, TaskStatus } from '~/utils/reminder'

const props = defineProps<{ task: Reminder; now: number; busy?: boolean }>()
const emit = defineEmits<{
  edit: [task: Reminder]
  remove: [task: Reminder]
  move: [task: Reminder, status: TaskStatus]
}>()

const NEXT: Record<TaskStatus, { to: TaskStatus; label: string; icon: string }> = {
  todo: { to: 'in_progress', label: 'شروع', icon: 'play' },
  in_progress: { to: 'done', label: 'انجام شد', icon: 'check' },
  done: { to: 'todo', label: 'بازگردانی', icon: 'undo' },
}

const info = computed(() => dueInfo(props.task.due_at, props.task.status, props.now))
const next = computed(() => NEXT[props.task.status])
</script>

<template>
  <article class="task" :class="[`task--${task.status}`, { 'task--overdue': info.tone === 'overdue' }]">
    <div class="flex items-start justify-between gap-2">
      <h4 class="task__title">{{ task.title }}</h4>
      <div class="flex shrink-0 gap-0.5">
        <button class="icon-btn" type="button" aria-label="ویرایش" title="ویرایش" @click="emit('edit', task)">
          <AppIcon name="pencil" :size="16" />
        </button>
        <button class="icon-btn icon-btn--danger" type="button" aria-label="حذف" title="حذف" :disabled="busy" @click="emit('remove', task)">
          <AppIcon name="trash" :size="16" />
        </button>
      </div>
    </div>

    <p v-if="task.description" class="task__desc">{{ task.description }}</p>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <span class="chip"><AppIcon name="calendar" :size="12" />{{ formatDue(task.due_at) }}</span>
      <span class="chip" :class="`chip--${info.tone}`">
        <AppIcon :name="info.tone === 'overdue' ? 'alert' : info.tone === 'done' ? 'check' : 'clock'" :size="12" />{{ info.text }}
      </span>
    </div>

    <div class="mt-3 flex justify-end">
      <button class="task__action" type="button" :disabled="busy" @click="emit('move', task, next.to)">
        <AppIcon :name="next.icon" :size="14" />{{ next.label }}
      </button>
    </div>
  </article>
</template>
