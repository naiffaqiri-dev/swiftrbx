const MAX_RECEIPT_BYTES = 4.5 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 2400
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const HEIC_TYPE = /image\/(heic|heif)/i
const HEIC_EXTENSION = /\.hei[cf]$/i

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('تعذّر تجهيز صورة الإيصال'))
    }, 'image/jpeg', quality)
  })
}

export async function prepareReceiptFile(file: File): Promise<File> {
  const isHeic = HEIC_TYPE.test(file.type) || HEIC_EXTENSION.test(file.name)
  if (!file.type.startsWith('image/') && !isHeic) {
    throw new Error('اختر صورة للإيصال، وليس ملفًا من نوع آخر')
  }

  let source: Blob = file
  if (isHeic) {
    try {
      const { default: convertHeic } = await import('heic2any')
      const converted = await convertHeic({ blob: file, toType: 'image/jpeg', quality: 0.84 })
      source = Array.isArray(converted) ? converted[0] : converted
    } catch {
      throw new Error('تعذّر فتح صورة HEIC. جرّب حفظها بصيغة JPG ثم أعد رفعها')
    }
  }

  if (SUPPORTED_TYPES.has(source.type) && source.size <= MAX_RECEIPT_BYTES) {
    if (source === file) return file
    return new File([source], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(source)
  } catch {
    throw new Error('تعذّر قراءة الصورة. اختر صورة JPG أو PNG أو WEBP')
  }

  try {
    let scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height))
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('تعذّر تجهيز صورة الإيصال')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

      for (const quality of [0.86, 0.76, 0.66]) {
        const compressed = await canvasToBlob(canvas, quality)
        if (compressed.size <= MAX_RECEIPT_BYTES) {
          const filename = `${file.name.replace(/\.[^.]+$/, '') || 'receipt'}.jpg`
          return new File([compressed], filename, { type: 'image/jpeg', lastModified: Date.now() })
        }
      }
      scale *= 0.78
    }
  } finally {
    bitmap.close()
  }

  throw new Error('حجم الصورة كبير. اختر صورة أصغر من 5 ميغابايت')
}

export const RECEIPT_ACCEPT = 'image/*,.heic,.heif'
export const RECEIPT_FORMAT_HINT = 'صور JPG وPNG وWEBP وHEIC، حتى 5 ميغابايت. تُجهّز صور الجوال تلقائيًا.'
