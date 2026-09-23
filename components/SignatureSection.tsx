'use client'

import React, { useRef, useState } from 'react'
import {
  Upload,
  Type,
  Trash2,
  PenTool,
  Check,
  Sparkles,
  User,
  Building,
  Crown,
  FileSignature,
  Eye,
  AlertCircle,
  EyeOff,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { processSignatureFile } from '@/lib/logo-utils'
import type { Invoice } from '@/lib/types'

export type SigneeKey = 'sales' | 'client' | 'ceo'

interface SignatureSectionProps {
  invoice: Invoice
  update: <K extends keyof Invoice>(field: K, value: Invoice[K]) => void
  activeSigneeTab?: SigneeKey
  onSelectSigneeTab?: (signee: SigneeKey) => void
}

export function SignatureSection({
  invoice,
  update,
  activeSigneeTab = 'ceo',
  onSelectSigneeTab,
}: SignatureSectionProps) {
  const [selectedTab, setSelectedTab] = useState<SigneeKey>(activeSigneeTab)
  const [dragActive, setDragActive] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync tab with external prop if provided
  const currentTab = onSelectSigneeTab ? activeSigneeTab : selectedTab
  const handleTabChange = (tab: SigneeKey) => {
    setSelectedTab(tab)
    onSelectSigneeTab?.(tab)
    setUploadError(null)
  }

  // Visibility checks
  const isVisible = (key: SigneeKey): boolean => {
    if (key === 'sales') return invoice.showSalesSignee === true
    if (key === 'client') return invoice.showClientSignee === true
    if (key === 'ceo') return invoice.showCeoSignee !== false
    return false
  }

  const toggleVisibility = (key: SigneeKey) => {
    if (key === 'sales') {
      update('showSalesSignee', !isVisible('sales') as any)
    } else if (key === 'client') {
      update('showClientSignee', !isVisible('client') as any)
    } else if (key === 'ceo') {
      update('showCeoSignee', !isVisible('ceo') as any)
    }
  }

  const applyPreset = (preset: 'ceo' | 'client' | 'sales' | 'all') => {
    if (preset === 'ceo') {
      update('showSalesSignee', false as any)
      update('showClientSignee', false as any)
      update('showCeoSignee', true as any)
      handleTabChange('ceo')
    } else if (preset === 'client') {
      update('showSalesSignee', false as any)
      update('showClientSignee', true as any)
      update('showCeoSignee', false as any)
      handleTabChange('client')
    } else if (preset === 'sales') {
      update('showSalesSignee', true as any)
      update('showClientSignee', false as any)
      update('showCeoSignee', false as any)
      handleTabChange('sales')
    } else if (preset === 'all') {
      update('showSalesSignee', true as any)
      update('showClientSignee', true as any)
      update('showCeoSignee', true as any)
    }
  }

  const isSalesVis = isVisible('sales')
  const isClientVis = isVisible('client')
  const isCeoVis = isVisible('ceo')

  const isCeoOnly = isCeoVis && !isSalesVis && !isClientVis
  const isClientOnly = isClientVis && !isSalesVis && !isCeoVis
  const isSalesOnly = isSalesVis && !isClientVis && !isCeoVis
  const isAllSelected = isSalesVis && isClientVis && isCeoVis

  const getActiveSummary = () => {
    const list: string[] = []
    if (isSalesVis) list.push('Sales Rep')
    if (isClientVis) list.push('Client')
    if (isCeoVis) list.push('CEO')
    if (list.length === 0) return 'No signees shown'
    if (isAllSelected) return 'All 3 signees visible'
    return `Shown: ${list.join(', ')}`
  }

  // Get current signee info
  const signeeConfig = {
    sales: {
      label: 'Sales Representative',
      shortLabel: 'Sales Rep',
      icon: User,
      nameField: 'salesName' as const,
      nameValue: invoice.salesName ?? 'Charlotte C. Santos',
      defaultName: 'Charlotte C. Santos',
      posField: 'salesPosition' as const,
      posValue: invoice.salesPosition ?? 'Senior Sales & Marketing Executive',
      defaultPos: 'Senior Sales & Marketing Executive',
      sigField: 'salesSignature' as const,
      sigValue: invoice.salesSignature || '',
      typeField: 'salesSignatureType' as const,
      typeValue: invoice.salesSignatureType || 'image',
    },
    client: {
      label: 'Client Representative',
      shortLabel: 'Client',
      icon: Building,
      nameField: 'clientSigneeName' as const,
      nameValue: invoice.clientSigneeName ?? (invoice.toName || ''),
      defaultName: invoice.toName || 'Client Representative',
      posField: 'clientSigneePosition' as const,
      posValue: invoice.clientSigneePosition ?? 'Client',
      defaultPos: 'Client',
      sigField: 'clientSignature' as const,
      sigValue: invoice.clientSignature || '',
      typeField: 'clientSignatureType' as const,
      typeValue: invoice.clientSignatureType || 'image',
    },
    ceo: {
      label: 'Chief Executive Officer',
      shortLabel: 'CEO / Exec',
      icon: Crown,
      nameField: 'ceoName' as const,
      nameValue: invoice.ceoName ?? 'Mary Grace E. Santos',
      defaultName: 'Mary Grace E. Santos',
      posField: 'ceoPosition' as const,
      posValue: invoice.ceoPosition ?? 'Chief Executive Officer',
      defaultPos: 'Chief Executive Officer',
      sigField: 'ceoSignature' as const,
      sigValue: invoice.ceoSignature || '',
      typeField: 'ceoSignatureType' as const,
      typeValue: invoice.ceoSignatureType || 'image',
    },
  }[currentTab]

  const hasSignature = (key: SigneeKey) => {
    if (key === 'sales') return !!invoice.salesSignature
    if (key === 'client') return !!invoice.clientSignature
    if (key === 'ceo') return !!invoice.ceoSignature
    return false
  }

  const handleFileUpload = async (file: File) => {
    setUploadError(null)
    setIsProcessing(true)
    try {
      const dataUrl = await processSignatureFile(file)
      update(signeeConfig.sigField, dataUrl as any)
      update(signeeConfig.typeField, 'image' as any)
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process signature file')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleClearSignature = () => {
    update(signeeConfig.sigField, '' as any)
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUseNameAsSignature = () => {
    const text = signeeConfig.nameValue || signeeConfig.defaultName
    update(signeeConfig.sigField, text as any)
    update(signeeConfig.typeField, 'text' as any)
  }

  const isImageSig =
    signeeConfig.sigValue &&
    (signeeConfig.typeValue === 'image' ||
      signeeConfig.sigValue.startsWith('data:image') ||
      signeeConfig.sigValue.startsWith('/') ||
      signeeConfig.sigValue.startsWith('http'))

  return (
    <div className="space-y-3.5 rounded-xl border border-border/80 bg-card p-3.5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-border/50">
        <div className="flex items-center gap-1.5 select-none">
          <FileSignature size={15} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Signees & E-Signatures
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">
          {getActiveSummary()}
        </span>
      </div>

      {/* Quick Presets: CEO Only, Client Only, Sales Only, All 3 */}
      <div className="p-2 rounded-lg bg-secondary/40 border border-border/70 space-y-1.5">
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="font-semibold text-foreground">
            Quick Display Selection:
          </span>
          <span className="text-muted-foreground text-[9.5px]">
            Choose which signees appear in Conforme
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() => applyPreset('ceo')}
            className={cn(
              "py-1 px-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer select-none text-center truncate",
              isCeoOnly
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-background text-muted-foreground hover:text-foreground border border-border"
            )}
            title="Show only the CEO in Acknowledgment & Conforme"
          >
            👑 CEO Only
          </button>
          <button
            type="button"
            onClick={() => applyPreset('client')}
            className={cn(
              "py-1 px-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer select-none text-center truncate",
              isClientOnly
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-background text-muted-foreground hover:text-foreground border border-border"
            )}
            title="Show only the Client in Acknowledgment & Conforme"
          >
            🏢 Client Only
          </button>
          <button
            type="button"
            onClick={() => applyPreset('sales')}
            className={cn(
              "py-1 px-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer select-none text-center truncate",
              isSalesOnly
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-background text-muted-foreground hover:text-foreground border border-border"
            )}
            title="Show only the Sales Rep in Acknowledgment & Conforme"
          >
            👤 Sales Only
          </button>
          <button
            type="button"
            onClick={() => applyPreset('all')}
            className={cn(
              "py-1 px-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer select-none text-center truncate",
              isAllSelected
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-background text-muted-foreground hover:text-foreground border border-border"
            )}
            title="Show all 3 signees (Sales, Client, CEO)"
          >
            👥 All 3
          </button>
        </div>
      </div>

      {/* Heading Text 'Acknowledgment & Conforme' Toggle */}
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/70">
        <div className="space-y-0.5 pr-2">
          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            Section Heading: <span className="font-mono text-[10px] text-muted-foreground">&quot;Acknowledgment &amp; Conforme&quot;</span>
          </span>
          <p className="text-[10px] text-muted-foreground">
            {invoice.showAcknowledgmentTitle !== false
              ? 'Heading text is displayed above the signatures.'
              : 'Heading text is hidden (clean signature lines only).'}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={invoice.showAcknowledgmentTitle !== false ? 'default' : 'outline'}
          onClick={() => update('showAcknowledgmentTitle', invoice.showAcknowledgmentTitle === false ? true : false)}
          className="h-7 text-xs font-semibold px-2.5 cursor-pointer shrink-0"
        >
          {invoice.showAcknowledgmentTitle !== false ? '✓ Text Shown' : '✕ Text Hidden'}
        </Button>
      </div>

      {/* 3 Tabs: Sales, Client, CEO (with visibility check toggles) */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-secondary/50 rounded-lg border border-border/60">
        {(['sales', 'client', 'ceo'] as const).map((tab) => {
          const isAct = currentTab === tab
          const hasSig = hasSignature(tab)
          const isVis = isVisible(tab)
          const TabIcon = tab === 'sales' ? User : tab === 'client' ? Building : Crown
          const tabLabel = tab === 'sales' ? 'Sales Rep' : tab === 'client' ? 'Client' : 'CEO'

          return (
            <div
              key={tab}
              className={cn(
                'flex items-center justify-between py-1.5 px-2 rounded-md transition-all relative border',
                isAct
                  ? 'bg-background text-foreground shadow-xs border-border/80'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50 border-transparent'
              )}
            >
              {/* Click label to switch active editing tab */}
              <button
                type="button"
                onClick={() => handleTabChange(tab)}
                className="flex items-center gap-1 text-xs font-semibold cursor-pointer select-none flex-1 truncate text-left"
              >
                <TabIcon size={12} className={isAct ? 'text-primary' : 'opacity-70'} />
                <span className="truncate">{tabLabel}</span>
                {hasSig && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                    title="E-Signature attached"
                  />
                )}
              </button>

              {/* Click toggle pill to include/exclude from quotation */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleVisibility(tab)
                }}
                className={cn(
                  'ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer select-none transition-all shrink-0',
                  isVis
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
                title={isVis ? 'Click to hide from quotation' : 'Click to show on quotation'}
              >
                {isVis ? '✓ ON' : 'OFF'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Visibility Status Card for the currently selected signee */}
      <div
        className={cn(
          'flex items-center justify-between p-2.5 rounded-lg border transition-all',
          isVisible(currentTab)
            ? 'bg-emerald-500/5 border-emerald-500/30'
            : 'bg-secondary/30 border-border'
        )}
      >
        <div className="space-y-0.5 pr-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-foreground">
              {signeeConfig.label} on Quotation:
            </span>
            <span
              className={cn(
                'text-[9.5px] font-extrabold px-1.5 py-0.5 rounded',
                isVisible(currentTab)
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-secondary text-muted-foreground'
              )}
            >
              {isVisible(currentTab) ? '✓ Shown on Quotation' : '✕ Hidden from Quotation'}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {isVisible(currentTab)
              ? 'This signee signature line and name are displayed in the footer.'
              : 'This signee is hidden. Click toggle to show on quotation.'}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant={isVisible(currentTab) ? 'default' : 'outline'}
          onClick={() => toggleVisibility(currentTab)}
          className="h-7 text-xs font-semibold px-3 cursor-pointer shrink-0"
        >
          {isVisible(currentTab) ? '✓ Visible' : '+ Show on Quotation'}
        </Button>
      </div>

      {/* Signee Text Inputs (Upload Texts Respectively) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-foreground flex items-center justify-between">
            <span>Signee Full Name</span>
            {signeeConfig.nameValue !== signeeConfig.defaultName && (
              <button
                type="button"
                onClick={() => update(signeeConfig.nameField, signeeConfig.defaultName as any)}
                className="text-[9.5px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                title="Reset to default name"
              >
                Reset
              </button>
            )}
          </Label>
          <Input
            value={signeeConfig.nameValue}
            onChange={(e) => update(signeeConfig.nameField, e.target.value as any)}
            placeholder={signeeConfig.defaultName}
            className="h-8 text-xs font-medium"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-foreground flex items-center justify-between">
            <span>Position / Designation</span>
            {signeeConfig.posValue !== signeeConfig.defaultPos && (
              <button
                type="button"
                onClick={() => update(signeeConfig.posField, signeeConfig.defaultPos as any)}
                className="text-[9.5px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                title="Reset to default position"
              >
                Reset
              </button>
            )}
          </Label>
          <Input
            value={signeeConfig.posValue}
            onChange={(e) => update(signeeConfig.posField, e.target.value as any)}
            placeholder={signeeConfig.defaultPos}
            className="h-8 text-xs font-medium"
          />
        </div>
      </div>

      {/* E-Signature Box / Uploader */}
      <div className="space-y-2 pt-1 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <PenTool size={13} className="text-primary" />
            <span className="text-[11px] font-semibold text-foreground">
              Electronic Signature (E-Sign)
            </span>
          </div>

          {/* Mode Switcher: Upload Image vs Type Cursive */}
          <div className="flex items-center gap-1 bg-secondary/80 p-0.5 rounded-md border border-border/60">
            <button
              type="button"
              onClick={() => update(signeeConfig.typeField, 'image' as any)}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer select-none',
                signeeConfig.typeValue === 'image'
                  ? 'bg-background text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Upload size={10} />
              <span>Upload Image</span>
            </button>
            <button
              type="button"
              onClick={() => update(signeeConfig.typeField, 'text' as any)}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer select-none',
                signeeConfig.typeValue === 'text'
                  ? 'bg-background text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Type size={10} />
              <span>Type Cursive</span>
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="flex items-center gap-1.5 p-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle size={13} className="shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* IMAGE MODE */}
        {signeeConfig.typeValue === 'image' && (
          <div className="space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0])
                }
              }}
            />

            {signeeConfig.sigValue && isImageSig ? (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-24 h-12 bg-white/90 rounded border border-border/80 flex items-center justify-center p-1 overflow-hidden shadow-2xs">
                    <img
                      src={signeeConfig.sigValue}
                      alt="Current Signature"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                      <Check size={12} />
                      <span>Signature Attached</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Displays crisp on quotation & PDF
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="h-7 text-xs px-2.5 cursor-pointer"
                  >
                    <Upload size={11} className="mr-1" />
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSignature}
                    className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                    title="Remove signature"
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all',
                  dragActive
                    ? 'border-primary bg-primary/5 scale-[0.99]'
                    : 'border-border/80 hover:border-primary/50 hover:bg-secondary/30',
                  isProcessing && 'opacity-60 pointer-events-none'
                )}
              >
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center mb-1.5 text-muted-foreground">
                  <Upload size={15} />
                </div>
                <p className="text-xs font-semibold text-foreground">
                  {isProcessing ? 'Processing signature...' : 'Upload Signature Image'}
                </p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">
                  Drag & drop or click to browse (PNG, SVG, JPG, WebP)
                </p>
                <span className="text-[9.5px] text-muted-foreground/70 mt-1">
                  Transparent background recommended · Auto-scaled to 500×200
                </span>
              </div>
            )}
          </div>
        )}

        {/* CURSIVE TEXT MODE */}
        {signeeConfig.typeValue === 'text' && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Input
                value={signeeConfig.sigValue}
                onChange={(e) => update(signeeConfig.sigField, e.target.value as any)}
                placeholder={`Type ${signeeConfig.nameValue || 'name'} for cursive signature...`}
                className="h-8 text-xs font-medium flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUseNameAsSignature}
                className="h-8 text-xs px-2.5 shrink-0 cursor-pointer"
                title="Use Signee Full Name as signature"
              >
                <Sparkles size={11} className="mr-1 text-primary" />
                Fill Name
              </Button>
              {signeeConfig.sigValue && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSignature}
                  className="h-8 text-xs px-2 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer shrink-0"
                  title="Clear text signature"
                >
                  <Trash2 size={12} />
                </Button>
              )}
            </div>

            {/* Live Cursive Script Preview */}
            <div className="p-3 bg-white text-[#111111] rounded-lg border border-border/80 text-center shadow-2xs">
              <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70 block mb-1">
                Live Cursive Preview:
              </span>
              <div className="h-10 flex items-center justify-center border-b border-[#333333] max-w-[200px] mx-auto pb-0.5">
                {signeeConfig.sigValue ? (
                  <span
                    className="text-[20px] font-normal italic leading-none tracking-wide truncate max-w-full"
                    style={{
                      fontFamily:
                        '"Caveat", "Dancing Script", "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive, serif',
                    }}
                  >
                    {signeeConfig.sigValue}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50 italic select-none">
                    (Type above to preview cursive e-sign)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
