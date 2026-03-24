<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';

const props = defineProps<{
  items: unknown[];
  itemHeight: number;
  overscan?: number;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const scrollTop = ref(0);
const containerHeight = ref(0);
const overscan = computed(() => props.overscan ?? 5);

const totalHeight = computed(() => props.items.length * props.itemHeight);

const visibleRange = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - overscan.value);
  const visibleCount = Math.ceil(containerHeight.value / props.itemHeight);
  const end = Math.min(props.items.length, start + visibleCount + overscan.value * 2);
  return { start, end };
});

const visibleItems = computed(() => {
  const { start, end } = visibleRange.value;
  return props.items.slice(start, end).map((item, index) => ({
    item,
    index: start + index,
  }));
});

const offsetY = computed(() => visibleRange.value.start * props.itemHeight);

function onScroll() {
  if (containerRef.value) {
    scrollTop.value = containerRef.value.scrollTop;
  }
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight;
    resizeObserver = new ResizeObserver((entries) => {
      containerHeight.value = entries[0]?.contentRect.height ?? 0;
    });
    resizeObserver.observe(containerRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <div
    ref="containerRef"
    class="overflow-y-auto"
    @scroll="onScroll"
  >
    <div :style="{ height: `${totalHeight}px`, position: 'relative' }">
      <div :style="{ transform: `translateY(${offsetY}px)` }">
        <slot
          v-for="{ item, index } in visibleItems"
          :key="index"
          :item="item"
          :index="index"
        />
      </div>
    </div>
  </div>
</template>
