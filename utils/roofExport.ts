import { Point, RoofPolygon, PlacedPanel, ScaleCalibration, PanelDimensions, RoofMetrics } from '@/types/roof'
import { getDistance, getPanelCorners, getPerspectivePanelVisuals } from './geometry'

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

  // 1. Preload aerial background photo if present to obtain natural dimensions
  let bgImg: HTMLImageElement | null = null
  if (backgroundImageUrl) {
    try {
      bgImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.onload = () => resolve(image)
        image.onerror = (err) => reject(err)
        image.src = backgroundImageUrl
      })
    } catch (err) {
      console.warn('Could not load background image for plan export:', err)
    }
  }

  // 2. Compute bounding box of all drawn elements (polygon, placed panels, scale ruler)
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
      const corners = getPanelCorners(panel)
      for (const pt of corners) {
        if (pt.x < minX) minX = pt.x
        if (pt.x > maxX) maxX = pt.x
        if (pt.y < minY) minY = pt.y
        if (pt.y > maxY) maxY = pt.y
      }
    }
  }

  // 3. Determine Canvas Dimensions and Coordinate Offsets
  // The actual background image should be exported completely without any cropping.
  let exportWidth: number
  let exportHeight: number
  let offsetX = 0
  let offsetY = 0

  if (bgImg) {
    const imgW = bgImg.naturalWidth || bgImg.width || 1920
    const imgH = bgImg.naturalHeight || bgImg.height || 1080

    // Ensure the entire background image is captured 1:1
    let originX = 0
    let originY = 0
    let boundW = imgW
    let boundH = imgH

    // If any drawn elements extend outside the image boundaries, expand canvas with padding so nothing is cut
    if (minX !== Infinity) {
      const pad = 40
      if (minX < 0) {
        originX = minX - pad
      }
      if (minY < 0) {
        originY = minY - pad
      }
      const rightEdge = Math.max(imgW, maxX + pad)
      const bottomEdge = Math.max(imgH, maxY + pad)
      boundW = rightEdge - originX
      boundH = bottomEdge - originY
    }

    exportWidth = Math.round(boundW)
    exportHeight = Math.round(boundH)
    offsetX = -originX
    offsetY = -originY
  } else {
    // No background image: blueprint mode encompassing all elements with padding
    if (minX === Infinity) {
      minX = 100
      maxX = 900
      minY = 100
      maxY = 700
    }
    const margin = 80
    const originX = minX - margin
    const originY = minY - margin
    const boundW = maxX - minX + margin * 2
    const boundH = maxY - minY + margin * 2

    exportWidth = Math.round(Math.max(1200, boundW))
    exportHeight = Math.round(Math.max(800, boundH))
    offsetX = -originX
    offsetY = -originY
  }

  canvas.width = exportWidth
  canvas.height = exportHeight

  // 4. Fill base dark blueprint background
  ctx.fillStyle = '#090d16'
  ctx.fillRect(0, 0, exportWidth, exportHeight)

  // Draw subtle grid texture if no image or in expanded margin
  if (!bgImg || offsetX !== 0 || offsetY !== 0 || exportWidth !== (bgImg.naturalWidth || bgImg.width)) {
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
  }

  // 5. Render aerial background photo at full opacity without cropping
  if (bgImg) {
    const imgW = bgImg.naturalWidth || bgImg.width
    const imgH = bgImg.naturalHeight || bgImg.height
    ctx.save()
    ctx.globalAlpha = 1.0 // Render the actual image at 100% clarity
    ctx.drawImage(bgImg, offsetX, offsetY, imgW, imgH)
    ctx.restore()
  }

  // Transform canvas coordinate space by the translation offset so all vector points match 1:1
  ctx.save()
  ctx.translate(offsetX, offsetY)
  const scaleRatio = 1

  // 6. Render Roof Polygon
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

      const visuals = getPerspectivePanelVisuals(quad)

      // 3D Extruded frame bevel edge in perspective on true bottom edge
      if (panel.isValid) {
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(visuals.bevelEdge.pA.x, visuals.bevelEdge.pA.y)
        ctx.lineTo(visuals.bevelEdge.pB.x, visuals.bevelEdge.pB.y)
        ctx.lineTo(visuals.bevelEdge.pB.x, visuals.bevelEdge.pB.y + 2.5 / scaleRatio)
        ctx.lineTo(visuals.bevelEdge.pA.x, visuals.bevelEdge.pA.y + 2.5 / scaleRatio)
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

        for (const line of visuals.rowLines) {
          ctx.beginPath()
          ctx.moveTo(line.pA.x, line.pA.y)
          ctx.lineTo(line.pB.x, line.pB.y)
          ctx.stroke()
        }

        ctx.beginPath()
        ctx.moveTo(visuals.centerLine.pA.x, visuals.centerLine.pA.y)
        ctx.lineTo(visuals.centerLine.pB.x, visuals.centerLine.pB.y)
        ctx.stroke()
      }

      // Wattage label at centroid
      const centerPt = visuals.center
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
      const rows = 5
      const isPortrait = panel.width <= panel.height

      if (isPortrait) {
        const cellH = panel.height / rows
        for (let r = 1; r < rows; r++) {
          ctx.beginPath()
          ctx.moveTo(0, r * cellH)
          ctx.lineTo(panel.width, r * cellH)
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.moveTo(panel.width / 2, 0)
        ctx.lineTo(panel.width / 2, panel.height)
        ctx.stroke()
      } else {
        const cellW = panel.width / rows
        for (let r = 1; r < rows; r++) {
          ctx.beginPath()
          ctx.moveTo(r * cellW, 0)
          ctx.lineTo(r * cellW, panel.height)
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.moveTo(0, panel.height / 2)
        ctx.lineTo(panel.width, panel.height / 2)
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

  ctx.restore() // End of translated layout

  // 7. Draw North Indicator
  ctx.save()
  const northX = Math.max(50, Math.min(80, exportWidth * 0.05))
  const northY = Math.max(50, Math.min(80, exportHeight * 0.05))
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
