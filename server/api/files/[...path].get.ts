// `blobStorage` auto-imported from server/utils/blob.ts.

// GET /api/files/** — Serve uploaded files (local dev proxy)
export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path')
  if (!path) {
    throw createError({ statusCode: 400, message: 'Path required' })
  }

  // Native video controls seek by requesting a byte range. The generic blob
  // serve() helper always returns 200 with the whole file, which makes the
  // browser's seek thumb jump back or stall on MP4 files.
  if (path.toLowerCase().endsWith('.mp4')) {
    const file = await blobStorage.get(path)
    if (!file) {
      throw createError({ statusCode: 404, message: 'File not found' })
    }

    setHeader(event, 'Accept-Ranges', 'bytes')
    setHeader(event, 'Content-Type', 'video/mp4')
    const range = getHeader(event, 'range')

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
      if (!match || (!match[1] && !match[2])) {
        setHeader(event, 'Content-Range', `bytes */${file.size}`)
        throw createError({ statusCode: 416, message: 'Invalid byte range' })
      }

      const suffixLength = !match[1] ? Number(match[2]) : null
      const start = suffixLength !== null
        ? Math.max(0, file.size - suffixLength)
        : Number(match[1])
      const requestedEnd = match[2] && match[1] ? Number(match[2]) : file.size - 1
      const end = Math.min(requestedEnd, file.size - 1)

      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= file.size) {
        setHeader(event, 'Content-Range', `bytes */${file.size}`)
        throw createError({ statusCode: 416, message: 'Byte range not satisfiable' })
      }

      const chunk = file.slice(start, end + 1, 'video/mp4')
      setResponseStatus(event, 206)
      setHeader(event, 'Content-Range', `bytes ${start}-${end}/${file.size}`)
      setHeader(event, 'Content-Length', String(chunk.size))
      return new Uint8Array(await chunk.arrayBuffer())
    }

    setHeader(event, 'Content-Length', String(file.size))
    return new Uint8Array(await file.arrayBuffer())
  }

  return blobStorage.serve(event, path)
})
