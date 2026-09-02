import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export interface PdfExportOptions {
  filename?: string
  onProgress?: (msg: string) => void
  container?: HTMLElement | null
  elements?: HTMLElement[]
  useSavePicker?: boolean
  returnBlobOnly?: boolean
}

export interface PdfExportResult {
  success: boolean
  blob?: Blob
  filename: string
}

/**
 * Saves a Blob to user's device using Web Share API (on iOS and supported mobile devices),
 * File System Access API (showSaveFilePicker on desktop), or direct browser download.
 */
export async function saveBlobWithPicker(
  blob: Blob,
  suggestedName: string,
  types?: Array<{ description: string; accept: Record<string, string[]> }>,
  useSavePicker: boolean = true
): Promise<boolean> {
  const isZip = suggestedName.toLowerCase().endsWith('.zip')
  const isPng = suggestedName.toLowerCase().endsWith('.png')
  const mimeType = isZip ? 'application/zip' : isPng ? 'image/png' : 'application/pdf'
  const isIosDevice = isIos()

  // 1. Web Share API (Primary and most reliable strategy for iOS Safari, and supported mobile browsers)
  // On iOS, this opens the native iOS Share Sheet ("Save to Files", "AirDrop", "Print", "Mail", etc.)
  if (isIosDevice && typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
    try {
      const file = new File([blob], suggestedName, { type: mimeType, lastModified: Date.now() })
      if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({
          files: [file],
          title: suggestedName,
        })
        return true
      }
    } catch (shareErr: any) {
      if (shareErr.name === 'AbortError') {
        // User deliberately dismissed/cancelled the share sheet
        return true
      }
      console.warn('iOS navigator.share failed, falling back to direct viewer/download:', shareErr)
    }
  }

  // 2. Desktop File System Access API (showSaveFilePicker) for Chrome / Edge / Opera desktop
  if (useSavePicker && typeof window !== 'undefined' && 'showSaveFilePicker' in window && !isIosDevice) {
    try {
      const defaultTypes = isZip
        ? [
            {
              description: 'ZIP Archive (*.zip)',
              accept: { 'application/zip': ['.zip'] },
            },
          ]
        : isPng
        ? [
            {
              description: 'PNG Image (*.png)',
              accept: { 'image/png': ['.png'] },
            },
          ]
        : [
            {
              description: 'PDF Document (*.pdf)',
              accept: { 'application/pdf': ['.pdf'] },
            },
          ]

      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: types || defaultTypes,
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return true
    } catch (pickerErr: any) {
      if (pickerErr.name === 'AbortError') {
        // User cancelled the file picker
        return true
      }
      console.warn('showSaveFilePicker failed, falling back to standard download:', pickerErr)
    }
  }

  // 3. Fallback direct download or iOS Safari PDF navigation
  try {
    const blobUrl = URL.createObjectURL(blob)

    // On iOS Safari, if Web Share is not available/failed and it is a PDF,
    // navigating to the PDF blob URL triggers Safari's native PDF preview reader
    if (isIosDevice && !isZip) {
      const opened = window.open(blobUrl, '_blank')
      if (!opened || opened.closed || typeof opened.closed === 'undefined') {
        window.location.href = blobUrl
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
      return true
    }

    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = blobUrl
    a.download = suggestedName
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      try {
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
      } catch {}
    }, 15000)
    return true
  } catch (err) {
    console.error('Blob download failed:', err)
    return false
  }
}

/**
 * Checks if current device is running iOS (iPhone, iPad, iPod)
 */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua)
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isAppleMobile || isIpadOs
}

/**
 * Exports the active quotation / capital / checklist preview directly to a pure A4 PDF file or Blob.
 */
export async function exportToPdfDirect({
  filename = 'Quotation.pdf',
  onProgress,
  container,
  elements,
  useSavePicker = true,
  returnBlobOnly = false,
}: PdfExportOptions = {}): Promise<PdfExportResult> {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { success: false, filename }
    }

    onProgress?.('Preparing pages...')

    // Locate visible printable page elements in the DOM or container
    let targetPages: HTMLElement[] = []
    if (elements && elements.length > 0) {
      targetPages = elements
    } else if (container) {
      const pageNodes = container.querySelectorAll<HTMLElement>('.print-page')
      targetPages = Array.from(pageNodes)
    } else {
      const allPageNodes = document.querySelectorAll<HTMLElement>('.print-page')
      if (!allPageNodes || allPageNodes.length === 0) {
        console.warn('No .print-page elements found to export')
        return { success: false, filename }
      }
      const visiblePages = Array.from(allPageNodes).filter((el) => {
        return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0
      })
      targetPages = visiblePages.length > 0 ? visiblePages : Array.from(allPageNodes)
    }

    if (targetPages.length === 0) {
      console.warn('No target pages found to export')
      return { success: false, filename }
    }

    const totalPages = targetPages.length

    // Standard ISO 216 A4 Dimensions in points: 595.28 pt x 841.89 pt (210mm x 297mm)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true,
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()

    // Canonical A4 pixel dimensions used across preview components
    const A4_WIDTH_PX = 794
    const A4_HEIGHT_PX = 1123

    // Global logger filters during PDF rasterization to prevent noisy parser warnings
    const origWarn = console.warn
    const origError = console.error
    const origLog = console.log
    const origInfo = console.info

    const isColorFunctionWarning = (args: unknown[]) => {
      try {
        const fullMsg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
        return (
          fullMsg.includes('unsupported color') ||
          fullMsg.includes('color function') ||
          fullMsg.includes('"lab"') ||
          fullMsg.includes('lab(') ||
          fullMsg.includes('"oklch"') ||
          fullMsg.includes('oklch(') ||
          fullMsg.includes('color-mix')
        )
      } catch {
        return false
      }
    }

    console.warn = (...args: unknown[]) => {
      if (isColorFunctionWarning(args)) return
      origWarn(...args)
    }
    console.error = (...args: unknown[]) => {
      if (isColorFunctionWarning(args)) return
      origError(...args)
    }
    console.log = (...args: unknown[]) => {
      if (isColorFunctionWarning(args)) return
      origLog(...args)
    }
    console.info = (...args: unknown[]) => {
      if (isColorFunctionWarning(args)) return
      origInfo(...args)
    }

    try {
      for (let i = 0; i < totalPages; i++) {
        const pageEl = targetPages[i]
        onProgress?.(`Rendering page ${i + 1} of ${totalPages}...`)

        // High-resolution canvas capture with desktop viewport simulation
        const canvas = await html2canvas(pageEl, {
          scale: 2, // 2x gives crystal clear 1588x2246 resolution
          width: A4_WIDTH_PX,
          height: A4_HEIGHT_PX,
          windowWidth: 1280,
          windowHeight: 1800,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000,
          onclone: (clonedDoc) => {
            // Reset all scroll positions to ensure top and bottom are never cropped
            if (clonedDoc.defaultView) {
              try { clonedDoc.defaultView.scrollTo(0, 0) } catch {}
            }
            if (clonedDoc.documentElement) {
              clonedDoc.documentElement.scrollTop = 0
              clonedDoc.documentElement.scrollLeft = 0
            }
            if (clonedDoc.body) {
              clonedDoc.body.scrollTop = 0
              clonedDoc.body.scrollLeft = 0
            }

            // Mute iframe console warnings for unsupported modern CSS color functions
            if (clonedDoc.defaultView) {
              clonedDoc.defaultView.console.error = (...args: unknown[]) => {
                if (isColorFunctionWarning(args)) return
                origError(...args)
              }
              clonedDoc.defaultView.console.warn = (...args: unknown[]) => {
                if (isColorFunctionWarning(args)) return
                origWarn(...args)
              }
              clonedDoc.defaultView.console.log = (...args: unknown[]) => {
                if (isColorFunctionWarning(args)) return
                origLog(...args)
              }

              // Intercept window.getComputedStyle to completely neutralize lab(), oklch(), color-mix()
              if (typeof clonedDoc.defaultView.getComputedStyle === 'function') {
                const origGetComputedStyle = clonedDoc.defaultView.getComputedStyle.bind(clonedDoc.defaultView)
                
                const sanitizeColorValue = (val: string, propKey: string = ''): string => {
                  if (!val || typeof val !== 'string') return val
                  if (
                    val.includes('lab(') ||
                    val.includes('oklch(') ||
                    val.includes('oklab(') ||
                    val.includes('lch(') ||
                    val.includes('color(') ||
                    val.includes('color-mix(')
                  ) {
                    const lowerKey = propKey.toLowerCase()
                    if (lowerKey.includes('background') || lowerKey.includes('bg')) {
                      return 'rgba(0, 0, 0, 0)'
                    }
                    if (lowerKey.includes('border') || lowerKey.includes('outline')) {
                      return 'rgb(229, 231, 235)'
                    }
                    if (lowerKey.includes('shadow')) {
                      return 'none'
                    }
                    return 'rgb(17, 17, 17)'
                  }
                  return val
                }

                clonedDoc.defaultView.getComputedStyle = function(el: Element, pseudo?: string | null) {
                  const style = origGetComputedStyle(el, pseudo)
                  return new Proxy(style, {
                    get(target, prop: string | symbol) {
                      const val = (target as any)[prop]
                      if (typeof val === 'string') {
                        return sanitizeColorValue(val, typeof prop === 'string' ? prop : '')
                      }
                      if (typeof val === 'function') {
                        if (prop === 'getPropertyValue') {
                          return function(propertyName: string) {
                            const res = target.getPropertyValue(propertyName)
                            return sanitizeColorValue(res, propertyName)
                          }
                        }
                        return val.bind(target)
                      }
                      return val
                    }
                  })
                }
              }
            }

            // Remove non-printable UI elements (modals, aside, toolbars) in the clone
            const nonPrintableNodes = clonedDoc.querySelectorAll<HTMLElement>(
              'aside, nav, [role="dialog"], .radix-dialog-overlay, [data-state="open"]:not(.print-page):not(.print-wrapper)'
            )
            nonPrintableNodes.forEach((node) => {
              if (!node.contains(clonedDoc.querySelector('.print-page'))) {
                try {
                  node.remove()
                } catch {}
              }
            })

            // Reset all scale wrappers in the cloned document so content is rendered at true 794x1123px
            const clonedWrappers = clonedDoc.querySelectorAll<HTMLElement>('.print-wrapper')
            clonedWrappers.forEach((w) => {
              w.style.width = `${A4_WIDTH_PX}px`
              w.style.height = `${A4_HEIGHT_PX}px`
              w.style.maxWidth = `${A4_WIDTH_PX}px`
              w.style.maxHeight = `${A4_HEIGHT_PX}px`
              w.style.transform = 'none'
              w.style.overflow = 'visible'
            })

            const clonedPages = clonedDoc.querySelectorAll<HTMLElement>('.print-page')
            clonedPages.forEach((p) => {
              p.style.width = `${A4_WIDTH_PX}px`
              p.style.height = `${A4_HEIGHT_PX}px`
              p.style.minHeight = `${A4_HEIGHT_PX}px`
              p.style.maxHeight = `${A4_HEIGHT_PX}px`
              p.style.transform = 'none'
              p.style.transformOrigin = 'top left'
              p.style.boxShadow = 'none'
              p.style.borderRadius = '0'
              p.style.border = 'none'
              p.style.backgroundColor = '#ffffff'
              p.style.color = '#111111'
            })

            // Sanitize all style tags in the cloned document to eliminate lab/oklch/lch/color-mix functions
            const styleTags = clonedDoc.querySelectorAll('style')
            styleTags.forEach((st) => {
              if (st.textContent) {
                st.textContent = st.textContent
                  .replace(/lab\([^)]*\)/gi, '#111111')
                  .replace(/oklch\([^)]*\)/gi, '#111111')
                  .replace(/oklab\([^)]*\)/gi, '#111111')
                  .replace(/lch\([^)]*\)/gi, '#111111')
                  .replace(/color-mix\([^)]*\)/gi, '#111111')
              }
            })

            // Sanitize stylesheets and elements inside the clone that might have modern color functions (lab, oklch, color-mix)
            const resetStyle = clonedDoc.createElement('style')
            resetStyle.textContent = `
              :root, [data-theme], html, body, * {
                --background: #ffffff !important;
                --foreground: #111111 !important;
                --card: #ffffff !important;
                --card-foreground: #111111 !important;
                --popover: #ffffff !important;
                --popover-foreground: #111111 !important;
                --primary: #111111 !important;
                --primary-foreground: #ffffff !important;
                --secondary: #f4f4f5 !important;
                --secondary-foreground: #111111 !important;
                --muted: #f4f4f5 !important;
                --muted-foreground: #71717a !important;
                --accent: #f4f4f5 !important;
                --accent-foreground: #111111 !important;
                --destructive: #ef4444 !important;
                --destructive-foreground: #ffffff !important;
                --border: #e4e4e7 !important;
                --input: #e4e4e7 !important;
                --ring: #18181b !important;
                outline: none !important;
                outline-color: transparent !important;
              }
              .print-page, .print-page * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-shadow: none !important;
              }
            `
            clonedDoc.head?.appendChild(resetStyle)

            const allElements = clonedDoc.querySelectorAll<HTMLElement>('*')
            allElements.forEach((el) => {
              const style = el.style
              if (style) {
                if (style.color && (style.color.includes('lab') || style.color.includes('oklch') || style.color.includes('color(') || style.color.includes('color-mix') || style.color.includes('lch'))) {
                  style.color = '#111111'
                }
                if (style.backgroundColor && (style.backgroundColor.includes('lab') || style.backgroundColor.includes('oklch') || style.backgroundColor.includes('color(') || style.backgroundColor.includes('color-mix') || style.backgroundColor.includes('lch'))) {
                  style.backgroundColor = 'transparent'
                }
                if (style.borderColor && (style.borderColor.includes('lab') || style.borderColor.includes('oklch') || style.borderColor.includes('color(') || style.borderColor.includes('color-mix') || style.borderColor.includes('lch'))) {
                  style.borderColor = '#e5e7eb'
                }
                if (style.outlineColor && (style.outlineColor.includes('lab') || style.outlineColor.includes('oklch') || style.outlineColor.includes('color(') || style.outlineColor.includes('color-mix') || style.outlineColor.includes('lch'))) {
                  style.outlineColor = 'transparent'
                }
                if (style.boxShadow && (style.boxShadow.includes('lab') || style.boxShadow.includes('oklch') || style.boxShadow.includes('color(') || style.boxShadow.includes('lch'))) {
                  style.boxShadow = 'none'
                }
              }
            })
          },
        })

        const imgData = canvas.toDataURL('image/jpeg', 0.95)

        if (i > 0) {
          pdf.addPage('a4', 'portrait')
        }

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST')
      }
    } finally {
      console.warn = origWarn
      console.error = origError
      console.log = origLog
      console.info = origInfo
    }

    onProgress?.('Finalizing PDF...')

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
    const pdfBlob = pdf.output('blob')

    if (returnBlobOnly) {
      return {
        success: true,
        blob: pdfBlob,
        filename: cleanFilename,
      }
    }

    const saved = await saveBlobWithPicker(pdfBlob, cleanFilename, undefined, useSavePicker)
    return { success: saved, blob: pdfBlob, filename: cleanFilename }
  } catch (err) {
    console.error('Error during direct PDF export:', err)
    return { success: false, filename: filename || 'error.pdf' }
  }
}

export interface PngExportOptions {
  filename?: string
  onProgress?: (msg: string) => void
  container?: HTMLElement | null
  elements?: HTMLElement[]
  useSavePicker?: boolean
  returnBlobOnly?: boolean
}

export interface PngExportResult {
  success: boolean
  blob?: Blob
  pages?: Array<{ filename: string; blob: Blob }>
  filename: string
}

/**
 * Exports the active quotation / capital / checklist preview directly to high-res PNG image(s).
 */
export async function exportToPngDirect({
  filename = 'Quotation.png',
  onProgress,
  container,
  elements,
  useSavePicker = true,
  returnBlobOnly = false,
}: PngExportOptions = {}): Promise<PngExportResult> {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { success: false, filename }
    }

    onProgress?.('Preparing pages for image export...')

    let targetPages: HTMLElement[] = []
    if (elements && elements.length > 0) {
      targetPages = elements
    } else if (container) {
      const pageNodes = container.querySelectorAll<HTMLElement>('.print-page')
      targetPages = Array.from(pageNodes)
    } else {
      const allPageNodes = document.querySelectorAll<HTMLElement>('.print-page')
      if (!allPageNodes || allPageNodes.length === 0) {
        console.warn('No .print-page elements found to export')
        return { success: false, filename }
      }
      const visiblePages = Array.from(allPageNodes).filter((el) => {
        return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0
      })
      targetPages = visiblePages.length > 0 ? visiblePages : Array.from(allPageNodes)
    }

    if (targetPages.length === 0) {
      console.warn('No target pages found to export')
      return { success: false, filename }
    }

    const totalPages = targetPages.length
    const A4_WIDTH_PX = 794
    const A4_HEIGHT_PX = 1123

    const origWarn = console.warn
    const origError = console.error
    const origLog = console.log
    const origInfo = console.info

    const isColorFunctionWarning = (args: unknown[]) => {
      try {
        const fullMsg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
        return (
          fullMsg.includes('unsupported color') ||
          fullMsg.includes('color function') ||
          fullMsg.includes('"lab"') ||
          fullMsg.includes('lab(') ||
          fullMsg.includes('"oklch"') ||
          fullMsg.includes('oklch(') ||
          fullMsg.includes('color-mix')
        )
      } catch {
        return false
      }
    }

    console.warn = (...args: unknown[]) => {
      if (isColorFunctionWarning(args)) return
      origWarn(...args)
    }
    console.error = (...args: unknown[]) => {
      if (isColorFunctionWarning(args)) return
      origError(...args)
    }
    console.log = (...args: unknown[]) => {
      if (isColorFunctionWarning(args)) return
      origLog(...args)
    }
    console.info = (...args: unknown[]) => {
      if (isColorFunctionWarning(args)) return
      origInfo(...args)
    }

    const generatedPageBlobs: Array<{ filename: string; blob: Blob }> = []
    const cleanBaseName = filename.replace(/\.pdf$/i, '').replace(/\.png$/i, '').replace(/\.zip$/i, '').trim()

    try {
      if (typeof document !== 'undefined' && (document as any).fonts && (document as any).fonts.ready) {
        try {
          await (document as any).fonts.ready
        } catch {}
      }

      for (let i = 0; i < totalPages; i++) {
        const pageEl = targetPages[i]
        onProgress?.(`Rendering image page ${i + 1} of ${totalPages}...`)

        const canvas = await html2canvas(pageEl, {
          scale: 2, // 2x gives crystal clear resolution
          width: A4_WIDTH_PX,
          height: A4_HEIGHT_PX,
          windowWidth: 1280,
          windowHeight: 1800,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000,
          onclone: (clonedDoc) => {
            if (clonedDoc.defaultView) {
              try { clonedDoc.defaultView.scrollTo(0, 0) } catch {}
            }
            if (clonedDoc.documentElement) {
              clonedDoc.documentElement.scrollTop = 0
              clonedDoc.documentElement.scrollLeft = 0
            }
            if (clonedDoc.body) {
              clonedDoc.body.scrollTop = 0
              clonedDoc.body.scrollLeft = 0
            }

            if (clonedDoc.defaultView) {
              clonedDoc.defaultView.console.error = (...args: unknown[]) => {
                if (isColorFunctionWarning(args)) return
                origError(...args)
              }
              clonedDoc.defaultView.console.warn = (...args: unknown[]) => {
                if (isColorFunctionWarning(args)) return
                origWarn(...args)
              }
              clonedDoc.defaultView.console.log = (...args: unknown[]) => {
                if (isColorFunctionWarning(args)) return
                origLog(...args)
              }

              if (typeof clonedDoc.defaultView.getComputedStyle === 'function') {
                const origGetComputedStyle = clonedDoc.defaultView.getComputedStyle.bind(clonedDoc.defaultView)
                
                const sanitizeColorValue = (val: string, propKey: string = ''): string => {
                  if (!val || typeof val !== 'string') return val
                  if (
                    val.includes('lab(') ||
                    val.includes('oklch(') ||
                    val.includes('oklab(') ||
                    val.includes('lch(') ||
                    val.includes('color(') ||
                    val.includes('color-mix(')
                  ) {
                    const lowerKey = propKey.toLowerCase()
                    if (lowerKey.includes('background') || lowerKey.includes('bg')) {
                      return 'rgba(0, 0, 0, 0)'
                    }
                    if (lowerKey.includes('border') || lowerKey.includes('outline')) {
                      return 'rgb(229, 231, 235)'
                    }
                    if (lowerKey.includes('shadow')) {
                      return 'none'
                    }
                    return 'rgb(17, 17, 17)'
                  }
                  return val
                }

                clonedDoc.defaultView.getComputedStyle = function(el: Element, pseudo?: string | null) {
                  const style = origGetComputedStyle(el, pseudo)
                  return new Proxy(style, {
                    get(target, prop: string | symbol) {
                      const val = (target as any)[prop]
                      if (typeof val === 'string') {
                        return sanitizeColorValue(val, typeof prop === 'string' ? prop : '')
                      }
                      if (typeof val === 'function') {
                        if (prop === 'getPropertyValue') {
                          return function(propertyName: string) {
                            const res = target.getPropertyValue(propertyName)
                            return sanitizeColorValue(res, propertyName)
                          }
                        }
                        return val.bind(target)
                      }
                      return val
                    }
                  })
                }
              }
            }

            const nonPrintableNodes = clonedDoc.querySelectorAll<HTMLElement>(
              'aside, nav, [role="dialog"], .radix-dialog-overlay, [data-state="open"]:not(.print-page):not(.print-wrapper)'
            )
            nonPrintableNodes.forEach((node) => {
              if (!node.contains(clonedDoc.querySelector('.print-page'))) {
                try { node.remove() } catch {}
              }
            })

            const clonedWrappers = clonedDoc.querySelectorAll<HTMLElement>('.print-wrapper')
            clonedWrappers.forEach((w) => {
              w.style.width = `${A4_WIDTH_PX}px`
              w.style.height = `${A4_HEIGHT_PX}px`
              w.style.maxWidth = `${A4_WIDTH_PX}px`
              w.style.maxHeight = `${A4_HEIGHT_PX}px`
              w.style.transform = 'none'
              w.style.overflow = 'visible'
            })

            const clonedPages = clonedDoc.querySelectorAll<HTMLElement>('.print-page')
            clonedPages.forEach((p) => {
              p.style.width = `${A4_WIDTH_PX}px`
              p.style.height = `${A4_HEIGHT_PX}px`
              p.style.minHeight = `${A4_HEIGHT_PX}px`
              p.style.maxHeight = `${A4_HEIGHT_PX}px`
              p.style.transform = 'none'
              p.style.transformOrigin = 'top left'
              p.style.boxShadow = 'none'
              p.style.borderRadius = '0'
              p.style.border = 'none'
              p.style.backgroundColor = '#ffffff'
              p.style.color = '#111111'
            })

            const styleTags = clonedDoc.querySelectorAll('style')
            styleTags.forEach((st) => {
              if (st.textContent) {
                st.textContent = st.textContent
                  .replace(/lab\([^)]*\)/gi, '#111111')
                  .replace(/oklch\([^)]*\)/gi, '#111111')
                  .replace(/oklab\([^)]*\)/gi, '#111111')
                  .replace(/lch\([^)]*\)/gi, '#111111')
                  .replace(/color-mix\([^)]*\)/gi, '#111111')
              }
            })

            const resetStyle = clonedDoc.createElement('style')
            resetStyle.textContent = `
              :root, [data-theme], html, body, * {
                --background: #ffffff !important;
                --foreground: #111111 !important;
                --card: #ffffff !important;
                --card-foreground: #111111 !important;
                --popover: #ffffff !important;
                --popover-foreground: #111111 !important;
                --primary: #111111 !important;
                --primary-foreground: #ffffff !important;
                --secondary: #f4f4f5 !important;
                --secondary-foreground: #111111 !important;
                --muted: #f4f4f5 !important;
                --muted-foreground: #71717a !important;
                --accent: #f4f4f5 !important;
                --accent-foreground: #111111 !important;
                --destructive: #ef4444 !important;
                --destructive-foreground: #ffffff !important;
                --border: #e4e4e7 !important;
                --input: #e4e4e7 !important;
                --ring: #18181b !important;
                outline: none !important;
                outline-color: transparent !important;
              }
              .print-page, .print-page * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-shadow: none !important;
              }
            `
            clonedDoc.head?.appendChild(resetStyle)

            const allElements = clonedDoc.querySelectorAll<HTMLElement>('*')
            allElements.forEach((el) => {
              const style = el.style
              if (style) {
                if (style.color && (style.color.includes('lab') || style.color.includes('oklch') || style.color.includes('color(') || style.color.includes('color-mix') || style.color.includes('lch'))) {
                  style.color = '#111111'
                }
                if (style.backgroundColor && (style.backgroundColor.includes('lab') || style.backgroundColor.includes('oklch') || style.backgroundColor.includes('color(') || style.backgroundColor.includes('color-mix') || style.backgroundColor.includes('lch'))) {
                  style.backgroundColor = 'transparent'
                }
                if (style.borderColor && (style.borderColor.includes('lab') || style.borderColor.includes('oklch') || style.borderColor.includes('color(') || style.borderColor.includes('color-mix') || style.borderColor.includes('lch'))) {
                  style.borderColor = '#e5e7eb'
                }
                if (style.outlineColor && (style.outlineColor.includes('lab') || style.outlineColor.includes('oklch') || style.outlineColor.includes('color(') || style.outlineColor.includes('color-mix') || style.outlineColor.includes('lch'))) {
                  style.outlineColor = 'transparent'
                }
                if (style.boxShadow && (style.boxShadow.includes('lab') || style.boxShadow.includes('oklch') || style.boxShadow.includes('color(') || style.boxShadow.includes('lch'))) {
                  style.boxShadow = 'none'
                }
              }
            })
          },
        })

        const pageBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b)
            else reject(new Error('Canvas toBlob failed'))
          }, 'image/png')
        })

        const pageFilename = totalPages > 1 
          ? `${cleanBaseName} - Page ${i + 1}.png` 
          : `${cleanBaseName}.png`

        generatedPageBlobs.push({ filename: pageFilename, blob: pageBlob })
      }
    } finally {
      console.warn = origWarn
      console.error = origError
      console.log = origLog
      console.info = origInfo
    }

    onProgress?.('Finalizing PNG image...')

    if (returnBlobOnly) {
      return {
        success: true,
        blob: generatedPageBlobs[0]?.blob,
        pages: generatedPageBlobs,
        filename: totalPages === 1 ? generatedPageBlobs[0].filename : `${cleanBaseName}.zip`,
      }
    }

    if (totalPages === 1) {
      const saved = await saveBlobWithPicker(generatedPageBlobs[0].blob, generatedPageBlobs[0].filename, undefined, useSavePicker)
      return {
        success: saved,
        blob: generatedPageBlobs[0].blob,
        pages: generatedPageBlobs,
        filename: generatedPageBlobs[0].filename,
      }
    } else {
      if (!useSavePicker) {
        // Direct individual file downloads without zip
        for (const item of generatedPageBlobs) {
          await saveBlobWithPicker(item.blob, item.filename, undefined, false)
          await new Promise((r) => setTimeout(r, 200))
        }
        return {
          success: true,
          blob: generatedPageBlobs[0].blob,
          pages: generatedPageBlobs,
          filename: generatedPageBlobs[0].filename,
        }
      }

      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      for (const item of generatedPageBlobs) {
        zip.file(item.filename, item.blob)
      }
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })
      const zipFilename = `${cleanBaseName}.zip`
      const saved = await saveBlobWithPicker(zipBlob, zipFilename, undefined, useSavePicker)
      return {
        success: saved,
        blob: zipBlob,
        pages: generatedPageBlobs,
        filename: zipFilename,
      }
    }
  } catch (err) {
    console.error('Error during direct PNG export:', err)
    return { success: false, filename: filename || 'error.png' }
  }
}
