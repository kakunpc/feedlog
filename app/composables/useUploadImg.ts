const IMAGE_MAX_BYTES = 20 * 1024 * 1024
const VIDEO_MAX_BYTES = 100 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg'])

export function useUploadImg(beforeUpload?: () => boolean | Promise<boolean>) {
  async function uploadFile(file: File): Promise<{ key: string; type: 'image' | 'video' }> {
    const isImage = IMAGE_TYPES.has(file.type)
    const isVideo = file.type === 'video/mp4'

    if (!isImage && !isVideo) throw new Error('unsupportedType')
    if (isImage && file.size > IMAGE_MAX_BYTES) throw new Error('imageTooLarge')
    if (isVideo && file.size > VIDEO_MAX_BYTES) throw new Error('videoTooLarge')

    const formData = new FormData()
    formData.append('file', file)
    return $fetch<{ key: string; type: 'image' | 'video' }>('/api/upload', {
      method: 'POST',
      body: formData,
    })
  }

  async function onUploadImg(files: File[], callback: (urls: string[]) => void) {
    if (!files.length || (beforeUpload && !await beforeUpload())) return
    const urls: string[] = []
    let failed = false
    for (const file of files) {
      try {
        const result = await uploadFile(file)
        if (typeof result.key !== 'string' || !result.key.trim() || result.type === 'video') throw new Error('Invalid image response')
        urls.push(`attachment:${result.key}`)
      } catch {
        failed = true
      }
    }
    if (urls.length) callback(urls)
    if (failed) throw new Error(urls.length ? 'partialUpload' : 'uploadFailed')
  }

  return { onUploadImg, uploadFile }
}

export function uploadErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  if (code === 'imageTooLarge') return '画像は20MB以下にしてください'
  if (code === 'videoTooLarge') return '動画は100MB以下にしてください'
  if (code === 'unsupportedType') return 'PNG、JPG、MP4のみアップロードできます'
  return 'ファイルをアップロードできませんでした'
}
