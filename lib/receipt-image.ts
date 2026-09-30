const MAX_SOURCE_BYTES = 25 * 1024 * 1024
const TARGET_BYTES = 4.5 * 1024 * 1024
const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}
const ACCEPTED_TYPES = new Set(Object.values(TYPE_BY_EXTENSION))

export class ReceiptImageError extends Error {}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ReceiptImageError('تعذّر تجهيز صورة الإيصال'))),
      'image/jpeg',
      quality,
    )
  })
}

function isHeic(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  return file.type === 'image/heic' || file.type === 'image/heif' || extension === 'heic' || extension === 'heif'
}

export async function prepareReceiptImage(file: File) {
  if (!file.size || file.size > MAX_SOURCE_BYTES) {
    throw new ReceiptImageError('حجم الصورة غير صالح. الحد الأقصى للصورة الأصلية 25 ميغابايت.')
  }

  let image: Blob = file
  let preparedFile = file
  const convertHeic = isHeic(file)

  if (convertHeic) {
    try {
      const { default: heic2any } = await import('heic2any')
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
      const convertedImage = Array.isArray(converted) ? converted[0] : converted
      if (!convertedImage) throw new ReceiptImageError('تعذّر تحويل الصورة')
      image = convertedImage
    } catch {
      throw new ReceiptImageError('تعذّر فتح صورة HEIC. جرّب حفظها بصيغة JPG ثم أعد رفعها.')
    }
  } else {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    const mimeType = ACCEPTED_TYPES.has(file.type) ? file.type : TYPE_BY_EXTENSION[extension]
    if (!mimeType) throw new ReceiptImageError('الصيغ المدعومة هي JPG وPNG وWEBP وHEIC.')
    if (file.type !== mimeType) {
      preparedFile = new File([file], file.name, { type: mimeType, lastModified: file.lastModified })
      image = preparedFile
    }
  }

  if (!convertHeic && preparedFile.size <= TARGET_BYTES) return preparedFile

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(image)
  } catch {
    throw new ReceiptImageError('تعذّر قراءة الصورة. جرّب صورة بصيغة JPG أو PNG أو WEBP.')
  }

  try {
    let scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height))
    let quality = 0.88

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new ReceiptImageError('تعذّر تجهيز صورة الإيصال')

      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const compressed = await canvasToJpeg(canvas, quality)
      if (compressed.size <= TARGET_BYTES) {
        const filename = file.name.replace(/\.[^.]+$/, '') || 'receipt'
        return new File([compressed], `${filename}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        })
      }

      if (quality > 0.68) {
        quality -= 0.1
      } else {
        scale *= 0.82
        quality = 0.82
      }
    }

    throw new ReceiptImageError('تعذّر تقليل حجم الصورة بما يكفي. جرّب صورة أصغر.')
  } finally {
    bitmap.close()
  }
}
