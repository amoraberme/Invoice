'use client'

import React, { useState, useRef } from 'react'
import { Upload, RotateCcw, Trash2, Image as ImageIcon, Link2, Check, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { processLogoFile, DEFAULT_LOGO, isDefaultLogo } from '@/lib/logo-utils'

interface LogoSectionProps {
  logo?: string
  fromName?: string
  onChange: (logoUrl: string) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  inputRef?: React.RefObject<HTMLInputElement | null>
}

export function LogoSection({
  logo,
  fromName,
  onChange,
  onMouseEnter,
  onMouseLeave,
  inputRef: externalInputRef,
}: LogoSectionProps) {
  const localInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = externalInputRef || localInputRef
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [customUrl, setCustomUrl] = useState('')

  const currentLogo = logo !== undefined ? logo : DEFAULT_LOGO
  const isDefault = isDefaultLogo(currentLogo)
  const isHidden = currentLogo === ''

  const handleFile = async (file: File) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsLoading(true)

    try {
      const dataUrl = await processLogoFile(file)
      onChange(dataUrl)
      setSuccessMessage('Logo updated successfully!')
      setTimeout(() => setSuccessMessage(null), 3500)
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process uploaded image.')
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleResetDefault = () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    onChange(DEFAULT_LOGO)
    setSuccessMessage('Reset to MG Solar logo')
    setTimeout(() => setSuccessMessage(null), 2500)
  }

  const handleRemoveLogo = () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    onChange('')
    setSuccessMessage('Logo removed from quotation')
    setTimeout(() => setSuccessMessage(null), 2500)
  }

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = customUrl.trim()
    if (!trimmed) return
    onChange(trimmed)
    setShowUrlInput(false)
    setCustomUrl('')
    setSuccessMessage('Logo URL applied!')
    setTimeout(() => setSuccessMessage(null), 2500)
  }

  return (
    <div 
      className="space-y-3"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-foreground tracking-tight">Logo</span>
          {isDefault && (
            <span className="text-[9.5px] font-medium text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-full border border-border">
              MG Solar
            </span>
          )}
          {!isDefault && !isHidden && (
            <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300/60 dark:border-emerald-800 flex items-center gap-1">
              <Check size={10} /> Custom Upload
            </span>
          )}
          {isHidden && (
            <span className="text-[9.5px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-300/60 dark:border-amber-800">
              Hidden
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowUrlInput(prev => !prev)}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-secondary transition-colors cursor-pointer"
            title="Paste logo URL directly"
          >
            <Link2 size={11} />
            <span>URL</span>
          </button>
        </div>
      </div>

      {/* Upload & Drop Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-xl border p-3.5 transition-all duration-200 bg-card",
          isDragging
            ? "border-primary bg-primary/5 ring-2 ring-primary/20 scale-[0.99]"
            : "border-border hover:border-border/80 shadow-2xs"
        )}
      >
        <div className="flex flex-col sm:flex-row items-center gap-3.5">
          {/* Logo Visual Preview Box */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "group relative w-full sm:w-[130px] h-[76px] rounded-lg border border-border/80 shrink-0 flex items-center justify-center overflow-hidden cursor-pointer transition-all bg-white",
              "bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:8px_8px] dark:bg-[radial-gradient(#374151_1px,transparent_1px)]",
              isDragging ? "ring-2 ring-primary" : "hover:border-primary/60 hover:shadow-xs"
            )}
            title="Click or drop to replace logo"
          >
            {!isHidden && currentLogo ? (
              <img
                src={currentLogo}
                alt={fromName || "Current Logo"}
                className="max-h-[64px] max-w-[114px] w-auto h-auto object-contain transition-transform duration-200 group-hover:scale-105"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground gap-1">
                <ImageIcon size={20} className="opacity-40" />
                <span className="text-[9px] font-medium">No Logo</span>
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-0.5 text-center p-1 select-none">
              <Upload size={14} />
              <span className="text-[9px] font-bold">Replace Logo</span>
            </div>
          </div>

          {/* Action Buttons & Info */}
          <div className="flex-1 w-full flex flex-col justify-between min-w-0 space-y-2">
            <div className="text-[11px] text-muted-foreground leading-snug">
              {isDragging ? (
                <span className="font-semibold text-primary">Drop logo file to upload immediately</span>
              ) : (
                <span>Upload company logo for quotation headers, packing checklist, and PDF export.</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={isLoading}
                onClick={() => fileInputRef.current?.click()}
                className="h-7 text-xs font-semibold px-2.5 gap-1.5 cursor-pointer shadow-xs"
              >
                <Upload size={12} />
                <span>{isLoading ? 'Processing...' : 'Upload Logo'}</span>
              </Button>

              {!isDefault && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleResetDefault}
                  className="h-7 text-xs px-2 gap-1 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary"
                  title="Reset back to default MG Solar logo"
                >
                  <RotateCcw size={11} />
                  <span>Reset Default</span>
                </Button>
              )}

              {!isHidden && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRemoveLogo}
                  className="h-7 text-xs px-2 gap-1 cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Hide logo from quotation"
                >
                  <Trash2 size={11} />
                  <span>Remove</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Formats hint */}
        <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Supported: PNG, SVG, JPG, WebP</span>
          <span>Max 800px auto-optimized</span>
        </div>
      </div>

      {/* URL Input dropdown */}
      {showUrlInput && (
        <form onSubmit={handleApplyCustomUrl} className="flex gap-1.5 pt-1">
          <Input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="h-8 text-xs font-mono"
            autoFocus
          />
          <Button type="submit" size="sm" className="h-8 text-xs px-3 font-semibold shrink-0 cursor-pointer">
            Apply
          </Button>
        </form>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
          <Check size={13} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-destructive bg-destructive/10 border border-destructive/20 px-2.5 py-1.5 rounded-lg">
          <AlertCircle size={13} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  )
}
