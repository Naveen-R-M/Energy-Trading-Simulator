"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { IconInfoCircle } from "@arco-design/web-react/icon"
import { Tooltip } from "@arco-design/web-react"

interface GlassCardProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  footer?: React.ReactNode
  isStale?: boolean
  lastUpdated?: Date
  info?: string
  className?: string
  headerClassName?: string
  contentClassName?: string
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({
    children,
    title,
    subtitle,
    actions,
    footer,
    isStale = false,
    lastUpdated,
    info,
    className,
    headerClassName,
    contentClassName,
    ...props
  }, ref) => {
    const formatLastUpdated = (date: Date) => {
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffSec = Math.floor(diffMs / 1000)
      const diffMin = Math.floor(diffSec / 60)
      
      if (diffSec < 60) return `${diffSec}s ago`
      if (diffMin < 60) return `${diffMin}m ago`
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
      <div
        ref={ref}
        className={cn(
          "glass rounded-card shadow-glass-lg transition-all duration-200 hover:shadow-glass-lg",
          "border border-glass-border/60",
          className
        )}
        {...props}
      >
        {/* Header */}
        {(title || subtitle || actions || info || lastUpdated || isStale) && (
          <div className={cn(
            "flex items-center justify-between p-4 border-b border-glass-border/30",
            headerClassName
          )}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {title && (
                  <div className="flex items-center gap-2">
                    <h3 className="text-16 font-semibold text-ink truncate">
                      {title}
                    </h3>
                    {info && (
                      <Tooltip content={info}>
                        <IconInfoCircle className="w-4 h-4 text-muted hover:text-accent cursor-help" />
                      </Tooltip>
                    )}
                  </div>
                )}
                {subtitle && (
                  <p className="text-14 text-muted mt-1 truncate">
                    {subtitle}
                  </p>
                )}
              </div>
              
              {/* Status indicators */}
              <div className="flex items-center gap-2">
                {isStale && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-12 font-medium bg-warning/10 text-warning rounded-chip">
                    <div className="w-2 h-2 bg-warning rounded-full" />
                    Stale
                  </span>
                )}
                
                {lastUpdated && (
                  <span className="text-12 text-muted">
                    {formatLastUpdated(lastUpdated)}
                  </span>
                )}
              </div>
            </div>
            
            {actions && (
              <div className="flex items-center gap-2 ml-4">
                {actions}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className={cn("p-4", contentClassName)}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 py-3 border-t border-glass-border/30">
            {footer}
          </div>
        )}
      </div>
    )
  }
)

GlassCard.displayName = "GlassCard"

export { GlassCard }
export type { GlassCardProps }
