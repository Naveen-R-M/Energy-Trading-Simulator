"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { GlassCard } from "./glass-card"
import { LineChart, Line, ResponsiveContainer } from "recharts"

interface KPITileProps {
  title: string
  value: string | number
  subtitle?: string
  change?: {
    value: number
    label: string
    isPositive?: boolean
  }
  sparkline?: Array<{ value: number }>
  isLive?: boolean
  isStale?: boolean
  lastUpdated?: Date
  size?: "small" | "large"
  className?: string
}

const KPITile = React.forwardRef<HTMLDivElement, KPITileProps>(
  ({
    title,
    value,
    subtitle,
    change,
    sparkline,
    isLive = false,
    isStale = false,
    lastUpdated,
    size = "small",
    className,
    ...props
  }, ref) => {
    const formatValue = (val: string | number) => {
      if (typeof val === 'number') {
        return val.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      }
      return val
    }

    return (
      <GlassCard
        ref={ref}
        className={cn(
          "relative",
          size === "large" ? "p-6" : "p-4",
          className
        )}
        isStale={isStale}
        lastUpdated={lastUpdated}
        {...props}
      >
        {/* Live indicator */}
        {isLive && (
          <div className="absolute top-3 right-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-buy rounded-full animate-pulse" />
              <span className="text-12 font-medium text-buy">LIVE</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {/* Title */}
          <div className="flex items-center justify-between">
            <h3 className={cn(
              "font-medium text-muted uppercase tracking-wider",
              size === "large" ? "text-14" : "text-12"
            )}>
              {title}
            </h3>
          </div>

          {/* Value */}
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "font-bold tabular-nums text-ink",
              size === "large" ? "text-32" : "text-24"
            )}>
              {typeof value === 'number' && value > 0 && title.toLowerCase().includes('lmp') ? '$' : ''}
              {formatValue(value)}
            </span>
            
            {change && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-chip text-12 font-medium",
                change.isPositive 
                  ? "bg-buy/10 text-buy" 
                  : "bg-sell/10 text-sell"
              )}>
                <span>{change.isPositive ? '↑' : '↓'}</span>
                <span>{change.label}</span>
              </div>
            )}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-14 text-muted">
              {subtitle}
            </p>
          )}

          {/* Sparkline */}
          {sparkline && sparkline.length > 0 && (
            <div className="mt-4 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkline}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="none"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </GlassCard>
    )
  }
)

KPITile.displayName = "KPITile"

// KPI Strip component for the interval chips
interface KPIStripProps {
  intervals: Array<{
    time: string
    value: number
    change?: number
    isCurrent?: boolean
  }>
  className?: string
}

const KPIStrip = React.forwardRef<HTMLDivElement, KPIStripProps>(
  ({ intervals, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex gap-3 overflow-x-auto pb-2", className)}
        {...props}
      >
        {intervals.map((interval, index) => (
          <div
            key={index}
            className={cn(
              "flex-shrink-0 glass rounded-chip px-4 py-2 min-w-[120px]",
              "transition-all duration-200 hover:shadow-glass-sm",
              interval.isCurrent && "ring-2 ring-accent/50 bg-accent/5"
            )}
          >
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="text-12 font-medium text-muted">
                  {interval.time}
                </span>
                {interval.isCurrent && (
                  <div className="w-1.5 h-1.5 bg-buy rounded-full animate-pulse" />
                )}
              </div>
              
              <div className="flex items-center justify-center gap-2">
                <span className="text-16 font-bold tabular-nums text-ink">
                  ${interval.value.toFixed(2)}
                </span>
                
                {interval.change !== undefined && (
                  <span className={cn(
                    "text-12 font-medium",
                    interval.change > 0 ? "text-buy" : interval.change < 0 ? "text-sell" : "text-muted"
                  )}>
                    {interval.change > 0 ? '+' : ''}{interval.change.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }
)

KPIStrip.displayName = "KPIStrip"

export { KPITile, KPIStrip }
export type { KPITileProps, KPIStripProps }
