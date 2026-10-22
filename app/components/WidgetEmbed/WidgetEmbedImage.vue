<script setup lang="ts">
import { resolveAttachmentUrl } from '#layers/feedlog/app/utils/attachment'

const props = defineProps<{ storageKey: string }>()
const src = computed(() => resolveAttachmentUrl(props.storageKey))
</script>

<template>
  <video v-if="src && storageKey.toLowerCase().endsWith('.mp4')" :src="src" controls preload="metadata" class="max-h-48 max-w-full rounded-lg" />
  <a v-else-if="src" :href="src" target="_blank" rel="noopener noreferrer">
    <img :src="src" :alt="$t('widget.attachedImage')" class="max-h-48 max-w-full rounded-lg object-contain" >
  </a>
  <span v-else class="text-xs text-muted-foreground">{{ $t('widget.attachedImage') }}</span>
</template>
