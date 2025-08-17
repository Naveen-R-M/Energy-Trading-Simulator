"use client"

import React from "react"
import { Card, Space, Typography, Tooltip } from "@arco-design/web-react"
import { IconArrowUp, IconArrowDown, IconMinus } from "@arco-design/web-react/icon"
import type { LMPData } from "@/app/page"

const { Text } = Typography

interface LivePriceStripProps {
  lmpData: LMPData[]
  loading?: boolean
  error?: string | null
}

const LivePriceStrip = React.memo(function LivePriceStrip({ lmpData, loading = false, error = null }: LivePriceStripProps) {
  const last6Intervals = lmpData.slice(-6)

  // Loading state
  if (loading) {
    return (
      <div className="p-4 bg-gradient-to-r from-card to-card/80">
        <div className="mb-3">
          <Text className="text-sm font-medium text-foreground">Loading latest prices...</Text>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="min-w-[160px] flex-shrink-0 animate-pulse bg-card border-border">
              <div className="text-center">
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-8 bg-muted rounded mb-3"></div>
                <div className="space-y-1">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 bg-gradient-to-r from-destructive/10 to-destructive/5">
        <div className="mb-3">
          <Text className="text-sm font-medium text-destructive">
            ❌ Error loading price data: {error}
          </Text>
        </div>
        <div className="flex justify-center items-center h-20 bg-destructive/10 rounded-lg border border-destructive/20">
          <Text className="text-destructive-foreground">Using fallback data. Check backend connection.</Text>
        </div>
      </div>
    )
  }

  // No data state
  if (last6Intervals.length === 0) {
    return (
      <div className="p-4 bg-background">
        <div className="flex justify-center items-center h-32 bg-card rounded-lg border-2 border-dashed border-muted">
          <Text className="text-muted-foreground">Waiting for price data...</Text>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gradient-to-r from-card to-card/80">
      <div className="mb-3 flex justify-between items-center">
        <Text className="text-sm font-medium text-foreground">Last 6 Intervals (5-min RT LMP)</Text>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <Text className="text-xs text-muted-foreground">
            🔄 Real-time data with components • Last update: {new Date(last6Intervals[last6Intervals.length - 1]?.timestamp).toLocaleTimeString()}
          </Text>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {last6Intervals.map((data, index) => {
          const prevData = index > 0 ? last6Intervals[index - 1] : null
          const priceChange = prevData ? data.lmp - prevData.lmp : 0
          const isUp = priceChange > 0.01
          const isDown = priceChange < -0.01
          const changePercent = prevData ? (priceChange / prevData.lmp) * 100 : 0

          const time = new Date(data.timestamp).toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
          })

          const cardClass = `min-w-[160px] flex-shrink-0 transition-all duration-200 hover:shadow-md bg-card border-border ${
            index === last6Intervals.length - 1 ? "ring-2 ring-accent/50 bg-accent/10" : ""
          }`

          return (
            <Card key={data.timestamp} className={cardClass}>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Text className="text-xs text-muted-foreground">{time}</Text>
                  {index === last6Intervals.length - 1 && (
                    <span className="text-xs bg-accent/20 text-accent px-1 rounded">LIVE</span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 mb-3">
                  <Text className="text-2xl font-bold text-accent">${data.lmp.toFixed(2)}</Text>
                  <div className="flex flex-col items-center">
                    {isUp && <IconArrowUp className="text-green-500 text-lg" />}
                    {isDown && <IconArrowDown className="text-red-500 text-lg" />}
                    {!isUp && !isDown && <IconMinus className="text-gray-400 text-lg" />}
                    {(isUp || isDown) && (
                      <Text className={`text-xs font-medium ${isUp ? "text-primary" : "text-secondary"}`}>
                        {changePercent > 0 ? "+" : ""}
                        {changePercent.toFixed(1)}%
                      </Text>
                    )}
                  </div>
                </div>

                <Space direction="vertical" size="mini" className="w-full">
                  <Tooltip content="Energy component of LMP">
                    <div className="flex justify-between text-xs hover:bg-muted/20 px-1 rounded">
                      <Text className="text-muted-foreground">Energy:</Text>
                      <Text className="font-medium text-foreground">${data.energy.toFixed(2)}</Text>
                    </div>
                  </Tooltip>

                  <Tooltip content="Congestion component of LMP">
                    <div className="flex justify-between text-xs hover:bg-muted/20 px-1 rounded">
                      <Text className="text-muted-foreground">Congestion:</Text>
                      <Text className={`font-medium ${data.congestion > 0 ? "text-secondary" : "text-primary"}`}>
                        ${data.congestion.toFixed(2)}
                      </Text>
                    </div>
                  </Tooltip>

                  <Tooltip content="Loss component of LMP">
                    <div className="flex justify-between text-xs hover:bg-muted/20 px-1 rounded">
                      <Text className="text-muted-foreground">Loss:</Text>
                      <Text className="font-medium text-foreground">${data.loss.toFixed(2)}</Text>
                    </div>
                  </Tooltip>
                </Space>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="mt-4 flex justify-center">
        <div className="flex gap-6 text-sm">
          <div className="text-center">
            <Text className="text-muted-foreground block">Avg LMP</Text>
            <Text className="font-semibold text-foreground">
              ${(last6Intervals.reduce((sum, d) => sum + d.lmp, 0) / last6Intervals.length).toFixed(2)}
            </Text>
          </div>
          <div className="text-center">
            <Text className="text-muted-foreground block">Range</Text>
            <Text className="font-semibold text-foreground">
              ${Math.min(...last6Intervals.map((d) => d.lmp)).toFixed(2)} - $
              {Math.max(...last6Intervals.map((d) => d.lmp)).toFixed(2)}
            </Text>
          </div>
          <div className="text-center">
            <Text className="text-muted-foreground block">Volatility</Text>
            <Text className="font-semibold text-foreground">
              {(Math.max(...last6Intervals.map((d) => d.lmp)) - Math.min(...last6Intervals.map((d) => d.lmp))).toFixed(
                2,
              )}
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
})

export default LivePriceStrip
