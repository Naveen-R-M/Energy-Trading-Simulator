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
      <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50">
        <div className="mb-3">
          <Text className="text-sm font-medium text-gray-700">Loading latest prices...</Text>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="min-w-[160px] flex-shrink-0 animate-pulse">
              <div className="text-center">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded mb-3"></div>
                <div className="space-y-1">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
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
      <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50">
        <div className="mb-3">
          <Text className="text-sm font-medium text-red-700">
            ❌ Error loading price data: {error}
          </Text>
        </div>
        <div className="flex justify-center items-center h-20 bg-red-100 rounded-lg border border-red-200">
          <Text className="text-red-600">Using fallback data. Check backend connection.</Text>
        </div>
      </div>
    )
  }

  // No data state
  if (last6Intervals.length === 0) {
    return (
      <div className="p-4">
        <div className="flex justify-center items-center h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Text className="text-gray-500">Waiting for price data...</Text>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50">
      <div className="mb-3 flex justify-between items-center">
        <Text className="text-sm font-medium text-gray-700">Last 6 Intervals (5-min RT LMP)</Text>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <Text className="text-xs text-gray-600">
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

          const cardClass = `min-w-[160px] flex-shrink-0 transition-all duration-200 hover:shadow-md ${
            index === last6Intervals.length - 1 ? "ring-2 ring-blue-200 bg-blue-50" : "bg-white"
          }`

          return (
            <Card key={data.timestamp} className={cardClass}>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Text className="text-xs text-gray-500">{time}</Text>
                  {index === last6Intervals.length - 1 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">LIVE</span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 mb-3">
                  <Text className="text-2xl font-bold text-blue-700">${data.lmp.toFixed(2)}</Text>
                  <div className="flex flex-col items-center">
                    {isUp && <IconArrowUp className="text-green-500 text-lg" />}
                    {isDown && <IconArrowDown className="text-red-500 text-lg" />}
                    {!isUp && !isDown && <IconMinus className="text-gray-400 text-lg" />}
                    {(isUp || isDown) && (
                      <Text className={`text-xs font-medium ${isUp ? "text-green-600" : "text-red-600"}`}>
                        {changePercent > 0 ? "+" : ""}
                        {changePercent.toFixed(1)}%
                      </Text>
                    )}
                  </div>
                </div>

                <Space direction="vertical" size="mini" className="w-full">
                  <Tooltip content="Energy component of LMP">
                    <div className="flex justify-between text-xs hover:bg-gray-50 px-1 rounded">
                      <Text className="text-gray-500">Energy:</Text>
                      <Text className="font-medium">${data.energy.toFixed(2)}</Text>
                    </div>
                  </Tooltip>

                  <Tooltip content="Congestion component of LMP">
                    <div className="flex justify-between text-xs hover:bg-gray-50 px-1 rounded">
                      <Text className="text-gray-500">Congestion:</Text>
                      <Text className={`font-medium ${data.congestion > 0 ? "text-red-600" : "text-green-600"}`}>
                        ${data.congestion.toFixed(2)}
                      </Text>
                    </div>
                  </Tooltip>

                  <Tooltip content="Loss component of LMP">
                    <div className="flex justify-between text-xs hover:bg-gray-50 px-1 rounded">
                      <Text className="text-gray-500">Loss:</Text>
                      <Text className="font-medium">${data.loss.toFixed(2)}</Text>
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
            <Text className="text-gray-500 block">Avg LMP</Text>
            <Text className="font-semibold">
              ${(last6Intervals.reduce((sum, d) => sum + d.lmp, 0) / last6Intervals.length).toFixed(2)}
            </Text>
          </div>
          <div className="text-center">
            <Text className="text-gray-500 block">Range</Text>
            <Text className="font-semibold">
              ${Math.min(...last6Intervals.map((d) => d.lmp)).toFixed(2)} - $
              {Math.max(...last6Intervals.map((d) => d.lmp)).toFixed(2)}
            </Text>
          </div>
          <div className="text-center">
            <Text className="text-gray-500 block">Volatility</Text>
            <Text className="font-semibold">
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
