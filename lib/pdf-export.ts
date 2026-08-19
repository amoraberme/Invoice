import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export interface PdfExportOptions {
  filename?: string
  onProgress?: (msg: string) => void
}

/**
 * Checks if the current browser/platform is iOS (iPhone, iPad, iPod)
 */
function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua)
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isAppleMobile || isIpadOs
}

/**
 * Exports the active quotation / capital / checklist pages directly to a pure A4 PDF file.
 * This completely avoids browser print dialogs (such as iOS Safari / WebKit print sheets)
 * that inject unwanted URL link footers, timestamp headers, or split pages into extras.
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

    // Locate visible printable page elements in the DOM
    const allPageNodes = document.querySelectorAll<HTMLElement>('.print-page')
    if (!allPageNodes || allPageNodes.length === 0) {
      console.warn('No .print-page elements found to export')
      return false
    }

    // Filter to only visible elements (to avoid exporting inactive hidden tabs)
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

    for (let i = 0; i < totalPages; i++) {
      const pageEl = targetPages[i]
      onProgress?.(`Rendering page ${i + 1} of ${totalPages}...`)

      // High-resolution canvas capture (scale 2.2 for crisp 200+ DPI text and graphic rendering)
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
          clonedEl.style.width = '794px'
          clonedEl.style.height = '1123px'
        },
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.95)

      if (i > 0) {
        pdf.addPage('a4', 'portrait')
      }

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST')
    }

    onProgress?.('Saving PDF...')

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
    const isIOS = isIosDevice()
    const blob = pdf.output('blob')

    // On iOS Safari: standard <a download> does not work for Blob files.
    // We open the clean PDF directly in Safari's native viewer or trigger file share.
    if (isIOS) {
      const blobUrl = URL.createObjectURL(blob)
      
      // Try opening in new window/tab for native iOS PDF QuickLook
      const newWin = window.open(blobUrl, '_blank')
      if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
        // Popups blocked, navigate directly in current window
        window.location.href = blobUrl
      }
      return true
    }

    // On Desktop (Chrome, Edge, Firefox, Mac Safari) and Android: direct file download
    pdf.save(cleanFilename)
    return true
  } catch (err) {
    console.error('Error during direct PDF export:', err)
    return false
  }
}
