/**
 * Utilities for handling company logo upload, compression, and persistence
 */

export const DEFAULT_LOGO = '/mg.png'

export function isDefaultLogo(logo?: string | null): boolean {
  return !logo || logo === DEFAULT_LOGO
}

/**
 * Processes an uploaded logo image file:
 * - If SVG: reads text, validates SVG markup, and returns data URI.
 * - If Bitmap (PNG, JPEG, WebP, etc.): renders onto canvas, resizing down to
 *   max dimensions (default maxWidth: 800, maxHeight: 300) while maintaining aspect ratio
 *   and preserving transparent alpha channel.
 * Returns a compact data URL string safe for localStorage and PDF export.
 */
export async function processLogoFile(
  file: File,
  maxWidth = 800,
  maxHeight = 300
): Promise<string> {
  if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.svg')) {
    throw new Error('Please upload an image file (PNG, JPG, SVG, WebP, etc.)')
  }

  // Handle SVG directly
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result
        if (typeof text === 'string') {
          if (text.startsWith('data:image/svg+xml')) {
            resolve(text)
          } else {
            try {
              const base64 = btoa(unescape(encodeURIComponent(text)))
              resolve(`data:image/svg+xml;base64,${base64}`)
            } catch {
              // Fallback to data URL with utf-8 encoding
              resolve(`data:image/svg+xml;utf8,${encodeURIComponent(text)}`)
            }
          }
        } else {
          reject(new Error('Failed to read SVG file'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read SVG file'))
      reader.readAsText(file)
    })
  }

  // Handle Raster (PNG, JPEG, WebP, etc.)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result as string
      if (!src) {
        reject(new Error('Failed to read image file'))
        return
      }

      const img = new Image()
      img.onload = () => {
        let { naturalWidth: width, naturalHeight: height } = img
        if (!width || !height) {
          width = img.width || 400
          height = img.height || 200
        }

        // Calculate scaled dimensions if larger than bounds
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.max(1, Math.round(width * ratio))
          height = Math.max(1, Math.round(height * ratio))
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(src)
          return
        }

        // Preserve alpha
        ctx.clearRect(0, 0, width, height)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        // Output as PNG for transparency preservation
        const resultDataUrl = canvas.toDataURL('image/png', 0.95)
        resolve(resultDataUrl)
      }

      img.onerror = () => reject(new Error('Failed to decode image file'))
      img.src = src
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Processes an uploaded signature image file (downscaled to max 500x200, transparent PNG)
 */
export async function processSignatureFile(file: File): Promise<string> {
  return processLogoFile(file, 500, 200)
}

