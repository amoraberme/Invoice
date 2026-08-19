import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export interface PdfExportOptions {
  filename?: string
  onProgress?: (msg: string) => void
}

/**
 * Checks if current device is running iOS (iPhone, iPad, iPod)
 */
function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua)
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isAppleMobile || isIpadOs
}

/**
 * Exports the active quotation / capital / checklist preview directly to a pure A4 PDF file.
 * Resets mobile screen zoom/scale transforms during rasterization so the PDF matches
 * the full-scale A4 preview exactly, with zero browser link footers and zero timestamp headers.
 */
export async function exportToPdfDirect({
  filename = 'Quotation.pdf',
  onProgress,
}: PdfExportOptions = {}): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false
    }

    onProgress?.('Preparing pages...')

    // Locate visible printable page elements in the DOM
    const allPageNodes = document.querySelectorAll<HTMLElement>('.print-page')
    if (!allPageNodes || allPageNodes.length === 0) {
      console.warn('No .print-page elements found to export')
      return false
    }

    // Filter to only visible elements
    const pages = Array.from(allPageNodes).filter((el) => {
      return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0
    })

    const targetPages = pages.length > 0 ? pages : Array.from(allPageNodes)
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
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000,
          onclone: (clonedDoc) => {
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
            }

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

    onProgress?.('Saving PDF...')

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`

    // Use jsPDF's built-in file saving which handles iOS Safari, Android, and Desktop downloads
    try {
      pdf.save(cleanFilename)
    } catch (saveError) {
      console.warn('pdf.save fallback to blob URL:', saveError)
      const blob = pdf.output('blob')
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = cleanFilename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
    }

    return true
  } catch (err) {
    console.error('Error during direct PDF export:', err)
    return false
  }
}
