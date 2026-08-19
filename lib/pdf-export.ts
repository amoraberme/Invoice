import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export interface PdfExportOptions {
  filename?: string
  onProgress?: (msg: string) => void
}

/**
 * Exports the active quotation / capital / checklist pages directly to a pure A4 PDF file.
 * This completely avoids browser print dialogs (such as iOS Safari / WebKit print sheets)
 * that inject unwanted URL link footers and timestamp headers.
 */
export async function exportToPdfDirect({
  filename = 'Quotation.pdf',
  onProgress,
}: PdfExportOptions = {}): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false
    }

    onProgress?.('Preparing document...')

    // Locate all printable page elements in the DOM
    const pageNodes = document.querySelectorAll<HTMLElement>('.print-page')
    if (!pageNodes || pageNodes.length === 0) {
      console.warn('No .print-page elements found to export')
      return false
    }

    const pages = Array.from(pageNodes)
    const totalPages = pages.length

    // A4 dimensions in points: 595.28 x 841.89 (Standard ISO 216 A4)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true,
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < totalPages; i++) {
      const pageEl = pages[i]
      onProgress?.(`Rendering page ${i + 1} of ${totalPages}...`)

      // Capture high-resolution raster image of the A4 page (scale 2.2 for crisp vector-like clarity)
      const canvas = await html2canvas(pageEl, {
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 10000,
        onclone: (_clonedDoc, clonedEl) => {
          // Reset transform scale and ensure white clean background in the captured clone
          clonedEl.style.transform = 'none'
          clonedEl.style.transformOrigin = 'top left'
          clonedEl.style.boxShadow = 'none'
          clonedEl.style.borderRadius = '0'
          clonedEl.style.border = 'none'
          clonedEl.style.backgroundColor = '#ffffff'
          clonedEl.style.color = '#111111'
        },
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.95)

      if (i > 0) {
        pdf.addPage('a4', 'portrait')
      }

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST')
    }

    onProgress?.('Saving PDF...')

    // Check if on iOS device and Web Share API is available for native file share/save
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const isIOS =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    const blob = pdf.output('blob')
    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`

    if (isIOS && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], cleanFilename, { type: 'application/pdf' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: cleanFilename,
          })
          return true
        }
      } catch (shareErr) {
        // User cancelled share or share failed; proceed to blob download fallback
        if ((shareErr as Error)?.name === 'AbortError') {
          return true
        }
      }
    }

    // Standard download via Blob URL for universal browser compatibility
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = cleanFilename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000)

    return true
  } catch (err) {
    console.error('Error during direct PDF export:', err)
    return false
  }
}
