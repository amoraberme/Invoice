import { Point, RoofPolygon, PlacedPanel, ScaleCalibration, PanelDimensions, RoofMetrics } from '@/types/roof'
import { getDistance, getPanelCorners } from './geometry'

interface ExportLayoutOptions {
  backgroundImageUrl: string | null
  imageOpacity: number
  polygon: RoofPolygon
  placedPanels: PlacedPanel[]
  scale: ScaleCalibration
  panelDimensions: PanelDimensions
  metrics: RoofMetrics
  projectName?: string
  fileName?: string
}

/**
 * Exports a high-resolution, presentation-ready architectural PNG plan of the finalized roof layout.
 */
export async function downloadRoofLayoutPng({
  backgroundImageUrl,
  imageOpacity,
  polygon,
  placedPanels,
  scale,
  panelDimensions,
  metrics,
  projectName: _projectName = 'Solar PV Roof Layout Plan',
  fileName,
}: ExportLayoutOptions): Promise<void> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context')

  // Standard high-res presentation dimensions
  const exportWidth = 1920
  const exportHeight = 1080
  canvas.width = exportWidth
  canvas.height = exportHeight

  // 1. Fill base dark blueprint background
  ctx.fillStyle = '#090d16'
  ctx.fillRect(0, 0, exportWidth, exportHeight)

  // Draw subtle grid texture
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
  ctx.lineWidth = 1
  const gridSize = 40
  for (let x = 0; x < exportWidth; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, exportHeight)
    ctx.stroke()
  }
  for (let y = 0; y < exportHeight; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(exportWidth, y)
    ctx.stroke()
  }

  // 2. Compute bounding box of content to automatically center and scale nicely onto 1920x1080
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  if (polygon.points.length > 0) {
    for (const pt of polygon.points) {
      if (pt.x < minX) minX = pt.x
      if (pt.x > maxX) maxX = pt.x
      if (pt.y < minY) minY = pt.y
      if (pt.y > maxY) maxY = pt.y
    }
  }

  for (const panel of placedPanels) {
    if (panel.customQuad) {
      for (const pt of panel.customQuad) {
        if (pt.x < minX) minX = pt.x
        if (pt.x > maxX) maxX = pt.x
        if (pt.y < minY) minY = pt.y
        if (pt.y > maxY) maxY = pt.y
      }
    } else {
      if (panel.x < minX) minX = panel.x
      if (panel.x + panel.width > maxX) maxX = panel.x + panel.width
      if (panel.y < minY) minY = panel.y
      if (panel.y + panel.height > maxY) maxY = panel.y + panel.height
    }
  }

  // Fallback defaults if empty
  if (minX === Infinity) {
    minX = 200
    maxX = 900
    minY = 150
    maxY = 600
  }

  // Add margin around bounding box
  const contentWidth = Math.max(200, maxX - minX)
  const contentHeight = Math.max(200, maxY - minY)
  const margin = 100

  // Full available canvas dimensions centered
  const availableW = exportWidth - margin * 2
  const availableH = exportHeight - margin * 2

  const scaleRatio = Math.min(2.5, Math.max(0.6, Math.min(availableW / contentWidth, availableH / contentHeight)))

  const contentCenterX = (minX + maxX) / 2
  const contentCenterY = (minY + maxY) / 2

  const targetCenterX = exportWidth / 2
  const targetCenterY = exportHeight / 2

  ctx.save()
  // Transform canvas coordinate space
  ctx.translate(targetCenterX, targetCenterY)
  ctx.scale(scaleRatio, scaleRatio)
  ctx.translate(-contentCenterX, -contentCenterY)

  // 3. Render aerial background photo if present
  if (backgroundImageUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.onload = () => resolve(image)
        image.onerror = (err) => reject(err)
        image.src = backgroundImageUrl
      })

      ctx.save()
      ctx.globalAlpha = Math.min(0.8, Math.max(0.2, imageOpacity))
      // Draw background centered with generous coverage
      const imgW = img.naturalWidth || 1024
      const imgH = img.naturalHeight || 576
      ctx.drawImage(img, 0, 0, imgW, imgH)
      ctx.restore()
    } catch {
      // If photo failed to load due to cross-origin or local network, gracefully proceed with blueprint
    }
  }

  // 4. Render Roof Polygon
  if (polygon.points.length >= 3) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(polygon.points[0].x, polygon.points[0].y)
    for (let i = 1; i < polygon.points.length; i++) {
      ctx.lineTo(polygon.points[i].x, polygon.points[i].y)
    }
    if (polygon.isClosed) {
      ctx.closePath()
    }

    // Semi-transparent blue fill
    ctx.fillStyle = 'rgba(37, 99, 235, 0.22)'
    ctx.fill()

    // Outer boundary stroke
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 3 / scaleRatio
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Edge Dimension Badges
    ctx.font = `bold ${Math.max(10, 11 / scaleRatio)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let i = 0; i < polygon.points.length; i++) {
      const p1 = polygon.points[i]
      const p2 = polygon.isClosed || i < polygon.points.length - 1 ? polygon.points[(i + 1) % polygon.points.length] : null
      if (!p2) continue

      const midX = (p1.x + p2.x) / 2
      const midY = (p1.y + p2.y) / 2
      const distM = (getDistance(p1, p2) / (scale.pixelsPerMeter || 35)).toFixed(1) + 'm'

      // Pill badge behind text
      const badgeW = 44 / scaleRatio
      const badgeH = 18 / scaleRatio
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 1 / scaleRatio
      ctx.beginPath()
      ctx.roundRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH, 4 / scaleRatio)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#38bdf8'
      ctx.fillText(distM, midX, midY)
    }

    ctx.restore()
  }

  // 5. Render Placed Solar Panels
  for (const panel of placedPanels) {
    if (panel.customQuad) {
      const quad = panel.customQuad

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(quad[0].x, quad[0].y)
      ctx.lineTo(quad[1].x, quad[1].y)
      ctx.lineTo(quad[2].x, quad[2].y)
      ctx.lineTo(quad[3].x, quad[3].y)
      ctx.closePath()

      ctx.fillStyle = !panel.isValid
        ? 'rgba(239, 68, 68, 0.65)'
        : panel.tiltAngle && panel.tiltAngle > 0
        ? 'rgba(30, 58, 138, 0.95)'
        : 'rgba(23, 37, 84, 0.95)'
      ctx.fill()

      ctx.strokeStyle = panel.isValid ? '#60a5fa' : '#ef4444'
      ctx.lineWidth = (panel.isValid ? 1.5 : 2.5) / scaleRatio
      ctx.lineJoin = 'round'
      ctx.stroke()

      // 3D Extruded frame bevel edge in perspective
      if (panel.isValid) {
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(quad[3].x, quad[3].y)
        ctx.lineTo(quad[2].x, quad[2].y)
        ctx.lineTo(quad[2].x, quad[2].y + 2.5)
        ctx.lineTo(quad[3].x, quad[3].y + 2.5)
        ctx.closePath()
        ctx.fillStyle = '#0f172a'
        ctx.strokeStyle = '#334155'
        ctx.lineWidth = 0.5 / scaleRatio
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }

      // Internal silicon wafer sub-cells in 3D perspective
      if (panel.isValid && panel.width > 20 && panel.height > 20) {
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.35)'
        ctx.lineWidth = 0.75 / scaleRatio

        for (let r = 1; r < 6; r++) {
          const t = r / 6
          const pLeft = {
            x: quad[0].x + (quad[3].x - quad[0].x) * t,
            y: quad[0].y + (quad[3].y - quad[0].y) * t,
          }
          const pRight = {
            x: quad[1].x + (quad[2].x - quad[1].x) * t,
            y: quad[1].y + (quad[2].y - quad[1].y) * t,
          }
          ctx.beginPath()
          ctx.moveTo(pLeft.x, pLeft.y)
          ctx.lineTo(pRight.x, pRight.y)
          ctx.stroke()
        }

        const midTop = { x: (quad[0].x + quad[1].x) / 2, y: (quad[0].y + quad[1].y) / 2 }
        const midBot = { x: (quad[3].x + quad[2].x) / 2, y: (quad[3].y + quad[2].y) / 2 }
        ctx.beginPath()
        ctx.moveTo(midTop.x, midTop.y)
        ctx.lineTo(midBot.x, midBot.y)
        ctx.stroke()
      }

      // Wattage label at centroid
      const centerPt = {
        x: (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4,
        y: (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4,
      }
      if (panel.isValid) {
        ctx.fillStyle = '#93c5fd'
        ctx.font = `600 ${Math.max(8, 9 / scaleRatio)}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const label = `${panelDimensions.wattage}W${panel.rotation ? ` • ${panel.rotation}°` : ''}`
        ctx.fillText(label, centerPt.x, centerPt.y)
      } else {
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${Math.max(10, 11 / scaleRatio)}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('!', centerPt.x, centerPt.y)
      }

      ctx.restore()
      continue
    }

    ctx.save()
    const cx = panel.width / 2
    const cy = panel.height / 2
    ctx.translate(panel.x + cx, panel.y + cy)
    if (panel.rotation) {
      ctx.rotate((panel.rotation * Math.PI) / 180)
    }
    ctx.translate(-cx, -cy)

    // Standoff mounting rack bracket if tiltAngle > 0
    if (panel.tiltAngle && panel.tiltAngle > 0 && panel.isValid) {
      ctx.fillStyle = '#475569'
      ctx.fillRect(2 / scaleRatio, -4 / scaleRatio, (panel.width - 4) / scaleRatio, 4 / scaleRatio)
      ctx.fillStyle = '#334155'
      ctx.fillRect(4 / scaleRatio, -7 / scaleRatio, 5 / scaleRatio, 7 / scaleRatio)
      ctx.fillRect((panel.width - 9) / scaleRatio, -7 / scaleRatio, 5 / scaleRatio, 7 / scaleRatio)
    }

    // Panel Fill
    ctx.fillStyle = panel.isValid
      ? panel.tiltAngle && panel.tiltAngle > 0
        ? 'rgba(30, 58, 138, 0.95)'
        : 'rgba(23, 37, 84, 0.95)'
      : 'rgba(239, 68, 68, 0.65)'
    ctx.beginPath()
    ctx.roundRect(0, 0, panel.width, panel.height, 2 / scaleRatio)
    ctx.fill()

    // Panel Outline
    ctx.strokeStyle = panel.isValid ? '#60a5fa' : '#ef4444'
    ctx.lineWidth = (panel.isValid ? 1.5 : 2.5) / scaleRatio
    ctx.stroke()

    // Internal silicon wafer sub-cells texture
    if (panel.isValid && panel.width > 20 && panel.height > 20) {
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.35)'
      ctx.lineWidth = 0.75 / scaleRatio
      const rows = 6
      const cols = 2
      const cellW = panel.width / cols
      const cellH = panel.height / rows

      for (let r = 1; r < rows; r++) {
        ctx.beginPath()
        ctx.moveTo(0, r * cellH)
        ctx.lineTo(panel.width, r * cellH)
        ctx.stroke()
      }
      for (let c = 1; c < cols; c++) {
        ctx.beginPath()
        ctx.moveTo(c * cellW, 0)
        ctx.lineTo(c * cellW, panel.height)
        ctx.stroke()
      }
    }

    // Tilt Badge on Top Right
    if (panel.tiltAngle && panel.tiltAngle > 0 && panel.isValid && panel.width > 34) {
      const badgeW = 28 / scaleRatio
      const badgeH = 12 / scaleRatio
      ctx.fillStyle = 'rgba(2, 132, 199, 0.92)'
      ctx.beginPath()
      ctx.roundRect(panel.width - badgeW - 3 / scaleRatio, 3 / scaleRatio, badgeW, badgeH, 3 / scaleRatio)
      ctx.fill()
      ctx.font = `bold ${Math.max(7, 8 / scaleRatio)}px sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`∠${panel.tiltAngle}°`, panel.width - badgeW / 2 - 3 / scaleRatio, 3 / scaleRatio + badgeH / 2)
    }

    // Wattage & Rotation Label
    if (panel.width > 24 && panel.height > 18) {
      ctx.fillStyle = panel.isValid ? '#93c5fd' : '#fee2e2'
      ctx.font = `600 ${Math.max(8, 9 / scaleRatio)}px monospace`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      const label = `${panelDimensions.wattage}W${panel.rotation ? ` • ${panel.rotation}°` : ''}`
      ctx.fillText(label, 3 / scaleRatio, panel.height - 3 / scaleRatio)
    }

    ctx.restore()
  }

  ctx.restore() // End of scaled layout

  // 6. Draw North Indicator (Top Left)
  ctx.save()
  const northX = 60
  const northY = 60
  ctx.translate(northX, northY)

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, 0, 26, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // North Arrow
  ctx.fillStyle = '#ef4444'
  ctx.beginPath()
  ctx.moveTo(0, -18)
  ctx.lineTo(6, 4)
  ctx.lineTo(-6, 4)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(0, 18)
  ctx.lineTo(6, 4)
  ctx.lineTo(-6, 4)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#f87171'
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('N', 0, -20)
  ctx.restore()

  // 7. Convert to Blob & Trigger Download
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas export failed'))
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const outName = fileName || `solar-roof-layout-${metrics.totalCapacityKwp.toFixed(2)}kWp.png`
      a.download = outName
      a.href = url
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      resolve()
    }, 'image/png')
  })
}
