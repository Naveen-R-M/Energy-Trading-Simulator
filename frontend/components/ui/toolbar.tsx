"use client"

import React, { useState } from "react"
import { Select, DatePicker, Input, Button } from "@arco-design/web-react"
import { 
  IconSearch, 
  IconCommand, 
  IconPlus, 
  IconSettings,
  IconRefresh,
  IconSun,
  IconMoon
} from "@arco-design/web-react/icon"
import { cn } from "@/lib/utils"

const { Option } = Select

interface ToolbarProps {
  selectedNode: string
  selectedDate: Date
  timezone: "UTC" | "ET"
  currentTime: Date
  onNodeChange: (node: string) => void
  onDateChange: (date: Date) => void
  onTimezoneToggle: () => void
  onTradeClick: () => void
  onRefresh?: () => void
  onThemeToggle?: () => void
  isDarkMode?: boolean
  className?: string
}

const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({
    selectedNode,
    selectedDate,
    timezone,
    currentTime,
    onNodeChange,
    onDateChange,
    onTimezoneToggle,
    onTradeClick,
    onRefresh,
    onThemeToggle,
    isDarkMode = false,
    className,
    ...props
  }, ref) => {
    const [commandOpen, setCommandOpen] = useState(false)
    const [searchValue, setSearchValue] = useState("")

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen(true)
      }
      if (e.key === 'Escape') {
        setCommandOpen(false)
        setSearchValue("")
      }
    }

    React.useEffect(() => {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    const formatTime = (date: Date, tz: "UTC" | "ET") => {
      const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: tz === 'ET' ? 'America/New_York' : 'UTC'
      }
      return date.toLocaleTimeString('en-US', options)
    }

    return (
      <div
        ref={ref}
        className={cn(
          "sticky top-0 z-50 glass rounded-none border-l-0 border-r-0 border-t-0",
          "border-b border-glass-border/60 backdrop-blur-glass backdrop-saturate-glass",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between px-6 py-3">
          {/* Left section - Brand and navigation */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <h1 className="text-20 font-bold text-ink">
                Virtual Energy Trading
              </h1>
              <div className="flex items-center gap-2 text-14 font-mono tabular-nums text-muted">
                <button
                  onClick={onTimezoneToggle}
                  className="px-2 py-1 rounded-field bg-glass-surface border border-glass-border/40 hover:bg-glass-surface/80 transition-colors"
                >
                  {timezone}
                </button>
                <span>{formatTime(currentTime, timezone)}</span>
              </div>
            </div>

            {/* Node and Date controls */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-12 font-medium text-muted uppercase tracking-wider">
                  Node
                </label>
                <Select
                  value={selectedNode}
                  onChange={onNodeChange}
                  style={{ width: 140 }}
                  size="default"
                  className="glass-select"
                >
                  <Option value="PJM-RTO">PJM-RTO</Option>
                  <Option value="NYISO">NYISO</Option>
                  <Option value="ISONE">ISO-NE</Option>
                  <Option value="CAISO">CAISO</Option>
                  <Option value="ERCOT">ERCOT</Option>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-12 font-medium text-muted uppercase tracking-wider">
                  Date
                </label>
                <DatePicker
                  value={selectedDate}
                  onChange={(date) => {
                    const validDate = date && date instanceof Date ? date : new Date()
                    onDateChange(validDate)
                  }}
                  size="default"
                  style={{ width: 160 }}
                  format="MM/DD/YYYY"
                  className="glass-picker"
                />
              </div>
            </div>
          </div>

          {/* Right section - Search and actions */}
          <div className="flex items-center gap-3">
            {/* Command/Search */}
            <div className="relative">
              <Input
                placeholder="Search or type command..."
                value={searchValue}
                onChange={setSearchValue}
                prefix={commandOpen ? <IconCommand className="w-4 h-4 text-muted" /> : <IconSearch className="w-4 h-4 text-muted" />}
                suffix={
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 text-12 bg-muted/10 text-muted rounded border">
                      {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
                    </kbd>
                    <kbd className="px-2 py-1 text-12 bg-muted/10 text-muted rounded border">
                      K
                    </kbd>
                  </div>
                }
                className="w-80 glass-input"
                size="default"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {onRefresh && (
                <Button
                  type="text"
                  size="default"
                  icon={<IconRefresh />}
                  onClick={onRefresh}
                  className="glass-button"
                />
              )}
              
              {onThemeToggle && (
                <Button
                  type="text"
                  size="default"
                  icon={isDarkMode ? <IconSun /> : <IconMoon />}
                  onClick={onThemeToggle}
                  className="glass-button"
                />
              )}

              <Button
                type="text"
                size="default"
                icon={<IconSettings />}
                className="glass-button"
              />

              {/* Primary Trade button */}
              <Button
                type="primary"
                size="default"
                icon={<IconPlus />}
                onClick={onTradeClick}
                className={cn(
                  "bg-accent hover:bg-accent/90 border-accent text-white font-medium",
                  "shadow-glass-sm hover:shadow-glass-lg transition-all duration-200",
                  "px-4"
                )}
              >
                Trade
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }
)

Toolbar.displayName = "Toolbar"

export { Toolbar }
export type { ToolbarProps }
