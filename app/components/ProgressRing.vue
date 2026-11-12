<script setup lang="ts">
const props = withDefaults(defineProps<{ value: number; size?: number; stroke?: number }>(), {
  size: 128,
  stroke: 9,
})

const uid = useId()
const radius = computed(() => (props.size - props.stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const offset = computed(() => circumference.value * (1 - Math.min(Math.max(props.value, 0), 100) / 100))
</script>

<template>
  <div class="progress-ring" :style="{ width: `${size}px`, height: `${size}px` }" role="img" :aria-label="`پیشرفت ${value} درصد`">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" style="transform: rotate(-90deg)">
      <defs>
        <linearGradient :id="`ring-${uid}`" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#22e4ff" />
          <stop offset="100%" stop-color="#9b6bff" />
        </linearGradient>
      </defs>
      <circle :cx="size / 2" :cy="size / 2" :r="radius" fill="none" stroke="rgba(255,255,255,0.07)" :stroke-width="stroke" />
      <circle
        class="progress-ring__bar"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="`url(#ring-${uid})`"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
      />
    </svg>
    <div style="position: absolute; inset: 0; display: grid; place-items: center; text-align: center">
      <slot />
    </div>
  </div>
</template>
