import sharp from 'sharp'
import { nanoid } from 'nanoid'

const IMAGE_MAX_BYTES = 20 * 1024 * 1024
const VIDEO_MAX_BYTES = 100 * 1024 * 1024
const ALLOWED_IMAGES = new Set(['image/png', 'image/jpeg'])

// POST /api/upload — one PNG/JPEG (20 MB) or one MP4 (100 MB).
// Images are converted in memory and only the resulting WebP is persisted.
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const orgId = event.context.orgId!
  const parts = await readMultipartFormData(event)
  const files = parts?.filter(part => part.name === 'file' && part.filename) ?? []

  if (files.length !== 1) {
    throw createError({ statusCode: 400, message: 'Upload exactly one file' })
  }

  const file = files[0]!
  const mimeType = (file.type ?? '').toLowerCase()
  const uploadPrefix = process.env.UPLOAD_PREFIX
    || process.env.NUXT_PUBLIC_UPLOAD_PREFIX
    || useRuntimeConfig().public.uploadPrefix
  const basePath = `${uploadPrefix}/${orgId}/${nanoid(20)}`

  if (ALLOWED_IMAGES.has(mimeType)) {
    if (file.data.byteLength > IMAGE_MAX_BYTES) {
      throw createError({ statusCode: 413, message: 'Images must be 20 MB or smaller' })
    }

    let webp: Buffer
    try {
      webp = await sharp(file.data, { limitInputPixels: 80_000_000 })
        .rotate()
        .webp({ quality: 82, effort: 4 })
        .toBuffer()
    } catch {
      throw createError({ statusCode: 400, message: 'Invalid PNG or JPEG image' })
    }

    const stored = await blobStorage.put(`${basePath}.webp`, webp, {
      contentType: 'image/webp',
    })
    return { key: stored.pathname, type: 'image' as const, mimeType: 'image/webp' }
  }

  if (mimeType === 'video/mp4') {
    if (file.data.byteLength > VIDEO_MAX_BYTES) {
      throw createError({ statusCode: 413, message: 'MP4 videos must be 100 MB or smaller' })
    }
    // ISO Base Media files (including MP4) carry an ftyp box near the start.
    if (file.data.byteLength < 12 || file.data.subarray(4, 8).toString('ascii') !== 'ftyp') {
      throw createError({ statusCode: 400, message: 'Invalid MP4 video' })
    }

    const stored = await blobStorage.put(`${basePath}.mp4`, file.data, {
      contentType: 'video/mp4',
    })
    return { key: stored.pathname, type: 'video' as const, mimeType: 'video/mp4' }
  }

  throw createError({ statusCode: 415, message: 'Only PNG, JPEG, and MP4 files are supported' })
})
