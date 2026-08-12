<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  apply: [result: ChangelogAiResult]
  close: []
}>()

const selectedFeedbackIds = ref<string[]>([])
const selectedFeedback = ref<{ id: string; title: string }[]>([])
const selectedStyle = ref<AiStyle>('concise')
const changeContent = ref('')
const generating = ref(false)
const error = ref('')
const attempted = ref(false)
const showPickerModal = ref(false)

const activePreviewId = ref<string | null>(null)
const previewContainer = ref<HTMLElement | null>(null)

onClickOutside(previewContainer, () => {
  activePreviewId.value = null
})

const { t } = useI18n()

const styleOptions = computed(() => [
  {
    id: 'concise' as AiStyle,
    name: t('changelog.ai.styles.concise.name'),
    desc: t('changelog.ai.styles.concise.desc'),
    example: `<p><strong>ダークモード切り替え機能</strong></p><p class="mt-1.5">個人設定からライトテーマとダークテーマを手動で切り替えられるようになりました。端末の設定に合わせて自動的に切り替えることもできます。</p>`,
  },
  {
    id: 'structured' as AiStyle,
    name: t('changelog.ai.styles.structured.name'),
    desc: t('changelog.ai.styles.structured.desc'),
    example: `<p><strong>v0.3.0 — 🌙 ダークモードとパフォーマンス改善</strong></p><p class="mt-1.5">多くのご要望をいただいていたダークモードを追加し、ロードマップの表示速度を大幅に改善しました。</p><p class="mt-3">💎 <strong>改善</strong></p><ul class="mt-1 ml-4 list-disc space-y-0.5"><li>個人設定にダークモード切り替えを追加</li><li>ドラッグ操作中のロードマップの描画遅延を軽減</li><li>多数のフィードバックを表示する際の読み込みを高速化</li></ul><p class="mt-3">🐞 <strong>修正</strong></p><ul class="mt-1 ml-4 list-disc space-y-0.5"><li>モバイル端末でアバターが表示されない問題を修正</li><li>添付ファイル付きコメントを削除すると強制終了する問題を修正</li></ul>`,
  },
  {
    id: 'benefit-led' as AiStyle,
    name: t('changelog.ai.styles.benefitLed.name'),
    desc: t('changelog.ai.styles.benefitLed.desc'),
    example: `<p><strong>ダークモードで夜間の作業をもっと快適に 🌙</strong></p><p class="mt-1.5">FeedLogをダークモードに切り替えられるようになりました。暗い環境でもフィードバックを読みやすく、目への負担を抑えながら管理できます。</p><ul class="mt-2 ml-4 list-disc space-y-0.5"><li>手動切り替えと端末テーマとの自動同期に対応</li><li>目の疲れを軽減する高コントラスト配色</li><li>ボード、ロードマップ、管理画面のすべてで利用可能</li></ul>`,
  },
  {
    id: 'witty' as AiStyle,
    name: t('changelog.ai.styles.witty.name'),
    desc: t('changelog.ai.styles.witty.desc'),
    example: `<p><strong>FeedLog v0.2.9</strong></p><p class="mt-1.5">ついに照明を落とす準備が整いました！ダークモードが正式に利用できます。週末にはロードマップを隅々まで掃除して、潜んでいた厄介な不具合も退治しました。これまで以上に快適なフィードバック探しをお楽しみください！</p>`,
  },
])

function removeFeedback(id: string) {
  selectedFeedbackIds.value = selectedFeedbackIds.value.filter(i => i !== id)
  selectedFeedback.value = selectedFeedback.value.filter(i => i.id !== id)
}

function handlePickerConfirm(items: { id: string; title: string }[]) {
  selectedFeedback.value = items
  selectedFeedbackIds.value = items.map(i => i.id)
  showPickerModal.value = false
}

async function handleGenerateAndApply() {
  attempted.value = true
  if (selectedFeedbackIds.value.length === 0 && !changeContent.value.trim()) {
    return
  }
  error.value = ''
  generating.value = true

  try {
    const result = await useApiFetch<ChangelogAiResult>('/api/admin/changelogs/ai/generate', {
      method: 'POST',
      body: {
        feedbackIds: selectedFeedbackIds.value,
        changeContent: changeContent.value.trim(),
        style: selectedStyle.value,
      },
    })
    emit('apply', result)
  } catch (e: any) {
    error.value = e?.data?.message || t('changelog.ai.generateFailed')
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 bg-black/45 p-4 sm:p-6 flex items-center justify-center backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl">
        <div class="flex items-center justify-between border-b border-border p-5">
          <div>
            <h3 class="font-heading text-lg font-bold">{{ $t('changelog.ai.title') }}</h3>
            <p class="text-xs text-muted-foreground mt-0.5">{{ $t('changelog.ai.subtitle') }}</p>
          </div>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-primary"
            @click="emit('close')"
          >
            <Icon name="lucide:x" size="20" />
          </button>
        </div>

        <div class="p-6 flex flex-col gap-6">

          <!-- 1. Select Feedback -->
          <section>
            <div class="mb-3 flex items-center justify-between">
              <h4 class="text-sm font-semibold text-foreground">
                {{ $t('changelog.ai.selectFeedback') }} <span class="text-xs font-normal text-muted-foreground">{{ $t('changelog.ai.optional') }}</span>
              </h4>
              <button
                type="button"
                class="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                :title="$t('changelog.ai.pickTooltip')"
                @click="showPickerModal = true"
              >
                <Icon name="lucide:search" size="14" />
                {{ $t('changelog.ai.pickFeedback') }}
              </button>
            </div>

            <div class="flex flex-col gap-3">
              <!-- Selected Pills -->
              <div v-if="selectedFeedback.length > 0" class="flex flex-wrap items-center gap-2">
                <div
                  v-for="item in selectedFeedback"
                  :key="item.id"
                  class="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-muted/30 pl-3 pr-1.5 text-xs font-medium text-foreground"
                >
                  <span class="max-w-[200px] truncate">{{ item.title }}</span>
                  <div class="flex items-center ml-0.5 gap-0.5">
                    <button
                      type="button"
                      class="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      :title="$t('changelog.ai.remove')"
                      @click="removeFeedback(item.id)"
                    >
                      <Icon name="lucide:x" size="14" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 2. Style Preset -->
          <section>
            <h4 class="mb-3 text-sm font-semibold text-foreground">
              {{ $t('changelog.ai.stylePreset') }}
            </h4>
            <div ref="previewContainer" class="grid gap-3 sm:grid-cols-2">
              <div
                v-for="(opt, index) in styleOptions"
                :key="opt.id"
                class="relative flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors cursor-pointer"
                :class="[
                  selectedStyle === opt.id ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted/50',
                  activePreviewId === opt.id ? 'z-10' : ''
                ]"
                @click="selectedStyle = opt.id"
              >
                <div class="flex w-full items-center justify-between">
                  <span class="text-sm font-semibold" :class="selectedStyle === opt.id ? 'text-primary' : 'text-foreground'">
                    {{ opt.name }}
                  </span>
                  <button
                    type="button"
                    class="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    :title="$t('changelog.ai.viewExample')"
                    @click.stop="activePreviewId = activePreviewId === opt.id ? null : opt.id"
                  >
                    <Icon name="lucide:info" size="14" />
                  </button>
                </div>
                <span class="text-[11px] leading-snug text-muted-foreground">
                  {{ opt.desc }}
                </span>

                <!-- Popup Preview -->
                <div
                  v-if="activePreviewId === opt.id"
                  class="absolute left-0 z-50 w-[320px] rounded-lg border border-border bg-popover p-4 shadow-xl cursor-default"
                  :class="index < 2 ? 'top-[calc(100%+8px)]' : 'bottom-[calc(100%+8px)]'"
                  @click.stop
                >
                  <p class="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{{ $t('changelog.ai.examplePreview') }}</p>
                  <div
                    class="text-[13px] text-popover-foreground leading-relaxed"
                    v-html="opt.example"
                  />
                </div>
              </div>
            </div>
          </section>

          <!-- 3. Change Content -->
          <section>
            <div class="mb-3 flex items-center justify-between">
              <h4 class="text-sm font-semibold text-foreground">
                {{ $t('changelog.ai.describeUpdates') }} <span class="text-xs font-normal text-muted-foreground">{{ $t('changelog.ai.optional') }}</span>
              </h4>
            </div>
            <div class="relative">
              <textarea
                v-model="changeContent"
                maxlength="2000"
                :placeholder="$t('changelog.ai.describePlaceholder')"
                class="h-[120px] w-full resize-none rounded-lg border border-border bg-background p-3 pb-8 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
              <div class="absolute bottom-2 right-3 text-[11px] text-muted-foreground/70 pointer-events-none">
                {{ changeContent.length }} / 2000
              </div>
            </div>
            <p v-if="attempted && selectedFeedbackIds.length === 0 && !changeContent.trim()" class="mt-2 text-xs font-medium text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
              <Icon name="lucide:alert-circle" size="14" />
              {{ $t('changelog.ai.provideOne') }}
            </p>
          </section>

          <!-- Error -->
          <div v-if="error" class="px-4 py-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
            {{ error }}
          </div>
        </div>

        <div class="flex justify-end gap-2 border-t border-border p-5">
          <button
            type="button"
            class="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            @click="emit('close')"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="generating || (selectedFeedbackIds.length === 0 && !changeContent.trim())"
            @click="handleGenerateAndApply"
          >
            <Icon v-if="generating" name="lucide:loader-2" size="14" class="animate-spin" />
            <Icon v-else name="lucide:wand-2" size="14" />
            {{ generating ? $t('changelog.ai.generating') : $t('changelog.ai.generate') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <ChangelogFeedbackPickerModal
    v-model:open="showPickerModal"
    :initial-selected-ids="selectedFeedbackIds"
    @confirm="handlePickerConfirm"
  />
</template>
