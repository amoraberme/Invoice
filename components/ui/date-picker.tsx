"use client"

import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

function toDate(value: string): Date | undefined {
  if (!value) return undefined
  return new Date(value + 'T00:00:00')
}

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

function DatePicker({ value, onChange, placeholder = 'Pick a date', className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <button
            type="button"
            className={cn(
              "h-9 w-full border border-[#E5E5E5] rounded-lg bg-[#FAFAFA] pl-3 pr-14 text-[13px] text-left flex items-center focus:outline-none focus:border-[#111111] transition-colors",
              value ? "text-[#111111]" : "text-[#BBBBBB]",
              className
            )}
          >
            <span className="truncate" suppressHydrationWarning>{value ? formatDate(value) : placeholder}</span>
          </button>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {value && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  onChange("")
                }}
                className="p-1 text-[#BBBBBB] hover:text-[#555555] hover:bg-[#E5E5E5] rounded-md transition-colors flex items-center justify-center"
                aria-label="Clear date"
              >
                <X size={12} />
              </button>
            )}
            <CalendarIcon size={13} className="text-[#888888] shrink-0 m-1" />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={toDate(value)}
          onSelect={(date) => {
            if (date) {
              const y = date.getFullYear()
              const m = String(date.getMonth() + 1).padStart(2, '0')
              const d = String(date.getDate()).padStart(2, '0')
              onChange(`${y}-${m}-${d}`)
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
