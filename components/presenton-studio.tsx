'use client'

import React, { useState, useRef } from 'react'
import {
  Presentation,
  UploadCloud,
  FileText,
  Sparkles,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  X,
  Copy,
  Check,
  SunMedium,
  Cpu,
  Layers,
  ShieldCheck,
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn, calculateTotal } from '@/lib/utils'
import type { Invoice } from '@/lib/types'

interface PresentonStudioProps {
  invoice: Invoice
  activeKwSetup: number
  systemType: 'hybrid' | 'ongrid'
}

export function PresentonStudio({
  invoice,
  activeKwSetup,
  systemType
}: PresentonStudioProps) {
  // Config & Credentials State
  const [presentonUrl, setPresentonUrl] = useState('')
  const [presentonKey, setPresentonKey] = useState('')
  const [showConfig, setShowConfig] = useState(false)

  // Form Controls
  const [customPrompt, setCustomPrompt] = useState('')
  const [template, setTemplate] = useState<'modern_solar' | 'executive_dark' | 'clean_minimal' | 'bold_financial'>('modern_solar')
  const [slideCount, setSlideCount] = useState<number>(8)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [fileDragOver, setFileDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Execution & Output State
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStep, setGenerationStep] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    pptx_url?: string
    pdf_url?: string
    edit_path?: string
    presentation_id?: string
    compiledPrompt?: string
  } | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  // Derived context summaries
  const clientName = invoice.toName || 'Valued Client'
  const clientAddress = invoice.toAddress || 'Philippines'
  const panelCount = (invoice.lineItems || []).find(it => it.description.toLowerCase().includes('panel'))?.quantity || 0
  const inverterDesc = (invoice.lineItems || []).find(it => it.description.toLowerCase().includes('inverter'))?.description || 'Smart Solar Inverter'
  const batteryItem = (invoice.lineItems || []).find(it => it.description.toLowerCase().includes('battery') || it.description.toLowerCase().includes('cesc') || it.description.toLowerCase().includes('genix'))
  const totalAmount = calculateTotal(invoice)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0])
      setError(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setFileDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadedFile(e.dataTransfer.files[0])
      setError(null)
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    setResult(null)
    setGenerationStep('Analyzing reference files and compiling solar system metadata...')

    try {
      const formData = new FormData()
      if (uploadedFile) {
        formData.append('file', uploadedFile)
      }
      formData.append('invoiceData', JSON.stringify({
        ...invoice,
        activeKwSetup,
        systemType,
        total: totalAmount
      }))
      formData.append('customPrompt', customPrompt)
      formData.append('template', template)
      formData.append('slideCount', String(slideCount))

      if (presentonUrl.trim()) formData.append('presentonUrl', presentonUrl.trim())
      if (presentonKey.trim()) formData.append('presentonKey', presentonKey.trim())

      setGenerationStep('Connecting to Presenton AI Presentation Engine...')

      const response = await fetch('/api/presentation/generate', {
        method: 'POST',
        body: formData
      })

      const resJson = await response.json()

      if (!response.ok || resJson.error) {
        throw new Error(resJson.error || 'Failed to generate presentation')
      }

      setResult({
        pptx_url: resJson.data?.pptx_url || resJson.data?.download_url || resJson.data?.url,
        pdf_url: resJson.data?.pdf_url,
        edit_path: resJson.data?.edit_path || resJson.data?.editor_url,
        presentation_id: resJson.data?.presentation_id || resJson.data?.id,
        compiledPrompt: resJson.compiledPrompt
      })
      setGenerationStep('Presentation generated successfully!')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An unexpected error occurred during deck generation.')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
              <Presentation size={20} />
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                Presenton AI Presentation Studio
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Custom Solar Deck Generator
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Transform active invoice specifications, electric bills, and layout PDFs into branded PowerPoint (.pptx) decks.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
            className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
          >
            <Sliders size={13} />
            {showConfig ? 'Hide API Config' : 'Engine Endpoint'}
          </Button>

          <a
            href="https://github.com/presenton/presenton"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border bg-background"
          >
            <ExternalLink size={12} /> Presenton Repo
          </a>
        </div>
      </div>

      {/* Optional Presenton API Configuration Banner */}
      {showConfig && (
        <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Cpu size={14} className="text-primary" /> Presenton Engine Endpoint Configuration
            </span>
            <span className="text-[10px] text-muted-foreground">
              Defaults to Presenton Cloud API or internal env variables if left blank
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Engine Base URL (Docker / Cloud)
              </Label>
              <Input
                placeholder="https://api.presenton.ai or http://localhost:8000"
                value={presentonUrl}
                onChange={(e) => setPresentonUrl(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">
                API Key / Bearer Token
              </Label>
              <Input
                type="password"
                placeholder="Presenton Bearer API Key (Optional for local Ollama)"
                value={presentonKey}
                onChange={(e) => setPresentonKey(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Left Setup & Upload, Right System Snapshot & Execution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Inputs & Reference Upload) - 7 Cols */}
        <div className="lg:col-span-7 space-y-5">
          {/* Step 1: Upload Reference Document */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <UploadCloud size={14} className="text-amber-500" />
                1. Reference Document (PDF, Meralco Bill, or Roof Layout)
              </Label>
              <span className="text-[10px] text-muted-foreground">Optional Grounding</span>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setFileDragOver(true) }}
              onDragLeave={() => setFileDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2",
                fileDragOver
                  ? "border-amber-500 bg-amber-500/10"
                  : uploadedFile
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-border hover:border-amber-500/50 hover:bg-secondary/30"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileChange}
              />

              {uploadedFile ? (
                <div className="flex items-center gap-3 text-left w-full justify-between px-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileCheck size={24} className="text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{uploadedFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(uploadedFile.size / 1024).toFixed(1)} KB • Attached for AI Parsing</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setUploadedFile(null) }}
                    className="p-1 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-3 rounded-full bg-secondary text-muted-foreground">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Click to upload or drag and drop</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Electric Bill PDF, Roof Satellite Screenshot, or Engineering Drawings
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Step 2: Pitch Deck Prompt & Custom Angle */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              2. Custom Sales Narrative & Focus Points
            </Label>
            <Textarea
              rows={4}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Focus on immediate brownout protection since client runs a clinic from home. Emphasize Tier-1 N-Type solar panel performance in cloudy weather and our 15-year warranty guarantee."
              className="text-xs resize-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {[
                'Brownout / Zero-Downtime Focus',
                'Maximum ROI & 3-Year Payback',
                'Tier-1 Premium Quality & Warranties',
                'Net Metering Export Revenue'
              ].map((pill) => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setCustomPrompt(prev => prev ? `${prev} ${pill}.` : `${pill}.`)}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/70 transition-all cursor-pointer"
                >
                  + {pill}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Deck Style & Slide Count */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Layers size={14} className="text-amber-500" />
              3. Visual Presentation Theme & Sizing
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'modern_solar', label: 'Solar Modern', desc: 'Clean Emerald & Amber accents' },
                { id: 'executive_dark', label: 'Executive Dark', desc: 'Premium midnight aesthetics' },
                { id: 'clean_minimal', label: 'Minimalist', desc: 'Bright white editorial format' },
                { id: 'bold_financial', label: 'Financial ROI', desc: 'Data charts and cashflow focus' }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id as any)}
                  className={cn(
                    "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20",
                    template === t.id
                      ? "border-amber-500 bg-amber-500/10 text-foreground shadow-xs font-semibold"
                      : "border-border bg-secondary/20 hover:bg-secondary/50 text-muted-foreground"
                  )}
                >
                  <span className="text-[11px] font-bold block">{t.label}</span>
                  <span className="text-[9px] leading-tight text-muted-foreground">{t.desc}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs font-semibold text-muted-foreground">Slide Target Count</span>
              <div className="flex items-center gap-1">
                {[6, 8, 10, 12].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSlideCount(num)}
                    className={cn(
                      "w-8 h-7 text-xs font-bold rounded-lg border transition-all cursor-pointer",
                      slideCount === num
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Context & Action Execution - 5 Cols */}
        <div className="lg:col-span-5 space-y-5">
          {/* Active Proposal Blueprint Card */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <SunMedium size={14} className="text-amber-500" /> Grounded Invoice Context
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {activeKwSetup}kW {systemType.toUpperCase()}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Client Target</span>
                <span className="font-bold text-foreground">{clientName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-foreground truncate max-w-[200px]">{clientAddress}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Solar Array</span>
                <span className="font-medium text-foreground">{panelCount}x Tier-1 PV Modules</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Main Inverter</span>
                <span className="font-medium text-foreground truncate max-w-[190px]">{inverterDesc}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Storage Battery</span>
                <span className="font-medium text-foreground">
                  {invoice.excludeBattery ? 'Battery-Ready (Excluded)' : batteryItem ? 'LiFePO4 Storage Unit' : 'N/A Grid-Tied'}
                </span>
              </div>
              <div className="flex justify-between py-1 pt-1.5">
                <span className="font-bold text-foreground">Total Proposal Value</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                  PHP {totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-11 text-xs font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 cursor-pointer gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating Presentation Deck...
                </>
              ) : (
                <>
                  <Presentation size={16} />
                  Generate Presentation (.PPTX)
                </>
              )}
            </Button>

            {isGenerating && (
              <p className="text-[11px] text-center text-amber-600 dark:text-amber-400 animate-pulse font-medium">
                {generationStep}
              </p>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2 text-destructive text-xs">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Generation Notice</p>
                  <p className="text-[11px] leading-relaxed">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Success Download Card */}
          {result && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <CheckCircle2 size={16} />
                Presentation Ready for Export
              </div>

              <div className="flex flex-col gap-2">
                {result.pptx_url ? (
                  <a
                    href={result.pptx_url}
                    download={`${clientName.replace(/\s+/g, '_')}_Solar_Proposal.pptx`}
                    className="w-full h-9 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                  >
                    <Download size={14} /> Download PowerPoint (.PPTX)
                  </a>
                ) : (
                  <Button
                    onClick={() => copyPrompt(result.compiledPrompt || '')}
                    variant="outline"
                    className="w-full h-9 text-xs font-bold gap-2 cursor-pointer border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                  >
                    {copiedPrompt ? <Check size={14} /> : <Copy size={14} />}
                    {copiedPrompt ? 'Copied Full Solar Deck Prompt' : 'Copy Compiled Deck Prompt'}
                  </Button>
                )}

                {result.edit_path && (
                  <a
                    href={result.edit_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-8 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-semibold hover:bg-secondary"
                  >
                    <ExternalLink size={13} /> Edit Live in Presenton
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
