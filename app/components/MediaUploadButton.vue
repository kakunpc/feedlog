<script setup lang="ts">
import { toast } from 'vue-sonner'
import { uploadErrorMessage } from '~/composables/useUploadImg'

const content = defineModel<string>('content', { required: true })
const input = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const { uploadFile } = useUploadImg()

async function selectVideo(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

  uploading.value = true
  try {
    const result = await uploadFile(file)
    if (result.type !== 'video') throw new Error('unsupportedType')
    const separator = content.value.trim() ? '\n\n' : ''
    content.value += `${separator}<video controls preload="metadata" src="attachment:${result.key}"></video>`
  } catch (error) {
    toast.error(uploadErrorMessage(error))
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div>
    <input ref="input" type="file" accept="video/mp4,.mp4" class="hidden" @change="selectVideo">
    <Button type="button" variant="outline" size="sm" :disabled="uploading" @click="input?.click()">
      <Icon :name="uploading ? 'lucide:loader-2' : 'lucide:video'" size="15" :class="{ 'animate-spin': uploading }" />
      {{ uploading ? $t('media.uploading') : $t('media.addVideo') }}
    </Button>
    <p class="mt-1 text-[11px] text-muted-foreground">{{ $t('media.videoHint') }}</p>
  </div>
</template>
