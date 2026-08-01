'use client'

import React, { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Download,
  Search,
  FileSpreadsheet,
  X,
  Eye,
  Loader2,
  Table as TableIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  theme?: string
  fileUrl?: string
  fileName?: string
}

export function SheetPreviewModal({
  open,
  onOpenChange,
  theme = 'light',
  fileUrl = '/GEPC-PRICELIST-UPDATED-MG-SOLAR AUG 1.xlsx',
  fileName = 'GEPC-PRICELIST-UPDATED-MG-SOLAR AUG 1.xlsx',
}: SheetPreviewModalProps) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'office'>('table')

  useEffect(() => {
    if (!open) return

    const loadExcel = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(fileUrl)
        if (!response.ok) throw new Error('Failed to fetch Excel file')
        const arrayBuffer = await response.arrayBuffer()
        const wb = XLSX.read(arrayBuffer, { type: 'array' })
        setWorkbook(wb)
        setSheetNames(wb.SheetNames)
        if (wb.SheetNames.length > 0) {
          setActiveSheet(wb.SheetNames[0])
        }
      } catch (err: any) {
        console.error('Error loading Excel sheet:', err)
        setError(err?.message || 'Error loading Excel file')
      } finally {
        setLoading(false)
      }
    }

    loadExcel()
  }, [open, fileUrl])

  // Parse active sheet rows
  const sheetData = useMemo(() => {
    if (!workbook || !activeSheet || !workbook.Sheets[activeSheet]) return []
    const ws = workbook.Sheets[activeSheet]
    const data: (string | number)[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
    })
    return data
  }, [workbook, activeSheet])

  // Filter rows based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return sheetData
    const q = searchQuery.toLowerCase()
    return sheetData.filter((row) =>
      row.some((cell) => String(cell).toLowerCase().includes(q))
    )
  }, [sheetData, searchQuery])

  // Encode file URL for Office Web Viewer embed
  const absoluteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${fileUrl}`
    : `https://mginvoice.vercel.app${fileUrl}`
  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-5xl w-[95vw] max-h-[90vh] h-[90vh] flex flex-col p-0 overflow-hidden font-mono rounded-[20px] border-2 shadow-2xl transition-all bg-card text-card-foreground", `theme-${theme}`)}>
        {/* Header Strip */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-secondary/40 shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-black tracking-tight text-foreground truncate">
                  Sheet Preview: {fileName}
                </DialogTitle>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0 hidden sm:inline-block">
                  Live View
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex bg-secondary p-0.5 rounded-lg border border-border gap-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none",
                  viewMode === 'table'
                    ? "bg-foreground text-background shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Interactive Table View"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                onClick={() => setViewMode('office')}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none",
                  viewMode === 'office'
                    ? "bg-foreground text-background shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Microsoft Office Web Viewer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Office Web</span>
              </button>
            </div>

            {/* Download Button */}
            <a
              href={fileUrl}
              download={fileName}
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-lg px-3 py-1.5 transition-all shadow-xs shrink-0 cursor-pointer select-none"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
          </div>
        </div>

        {/* Search & Tabs Toolbar (For Table View) */}
        {viewMode === 'table' && (
          <div className="flex flex-wrap items-center justify-between px-5 py-2.5 border-b border-border bg-card shrink-0 gap-3">
            {/* Sheet Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none max-w-full sm:max-w-md">
              {sheetNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveSheet(name)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer select-none border",
                    activeSheet === name
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-secondary/60 text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
                  )}
                >
                  {name}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search item, price, model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-secondary border border-border text-foreground text-xs rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-primary transition-all font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-hidden relative bg-card">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/80 backdrop-blur-xs">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span className="text-xs font-bold text-muted-foreground">
                Loading Pricelist Data...
              </span>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-sm font-bold text-rose-500 mb-2">{error}</p>
              <Button
                onClick={() => setViewMode('office')}
                variant="outline"
                className="text-xs font-bold"
              >
                Try Office Web Viewer
              </Button>
            </div>
          ) : viewMode === 'table' ? (
            <div className="w-full h-full overflow-auto p-4 scrollbar-thin">
              {filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs">
                  No matching records found for "{searchQuery}"
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <tbody>
                      {filteredData.map((row, rowIndex) => {
                        const isHeader = rowIndex === 0
                        return (
                          <tr
                            key={rowIndex}
                            className={cn(
                              "border-b border-border/60 transition-colors",
                              isHeader
                                ? "bg-secondary text-foreground font-black sticky top-0 border-b-2 border-border shadow-xs"
                                : rowIndex % 2 === 0
                                ? "bg-card hover:bg-secondary/40 text-card-foreground"
                                : "bg-secondary/20 hover:bg-secondary/40 text-card-foreground"
                            )}
                          >
                            <td className="px-3 py-2 text-[10px] text-muted-foreground font-bold border-r border-border/40 select-none text-center bg-secondary/50 w-10 shrink-0">
                              {rowIndex + 1}
                            </td>
                            {row.map((cell, colIndex) => (
                              <td
                                key={colIndex}
                                className={cn(
                                  "px-3.5 py-2 border-r border-border/30 last:border-r-0 whitespace-pre-wrap break-words",
                                  isHeader ? "font-extrabold text-[11px] uppercase tracking-tight" : "text-xs"
                                )}
                              >
                                {cell !== undefined && cell !== null ? String(cell) : ''}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <iframe
              src={officeViewerUrl}
              className="w-full h-full border-none"
              title="Microsoft Office Sheet Viewer"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
