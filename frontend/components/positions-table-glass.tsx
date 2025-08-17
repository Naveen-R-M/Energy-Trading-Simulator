"use client"

import { useState } from "react"
import { Card, Typography, Button, Badge, Divider, Tabs } from "@arco-design/web-react"
import { IconUser, IconTrendingUp, IconTrendingDown } from "@arco-design/web-react/icon"
import type { TradePosition } from "@/app/page"

const { Title, Text } = Typography
const { TabPane } = Tabs

interface PositionsTableGlassProps {
  positions: TradePosition[]
  currentTime: Date
}

interface PositionSummary {
  totalPositions: number
  totalPL: number
  openBuy: number
  openSell: number
  projectedPL: number
}

export default function PositionsTableGlass({ positions, currentTime }: PositionsTableGlassProps) {
  const [activeTab, setActiveTab] = useState<string>("open")

  // Keep all your existing position calculation logic
  const openPositions = positions.filter(pos => pos.filledIntervals < 12)
  const closedPositions = positions.filter(pos => pos.filledIntervals >= 12)

  const calculateSummary = (): PositionSummary => {
    const summary = openPositions.reduce(
      (acc, pos) => {
        acc.totalPositions += 1
        acc.totalPL += pos.livePL
        if (pos.side === "Buy") {
          acc.openBuy += pos.quantity
        } else {
          acc.openSell += pos.quantity
        }
        acc.projectedPL += pos.projectedPL || 0
        return acc
      },
      {
        totalPositions: 0,
        totalPL: 0,
        openBuy: 0,
        openSell: 0,
        projectedPL: 0,
      }
    )
    return summary
  }

  const summary = calculateSummary()

  const formatPL = (value: number) => {
    const formatted = Math.abs(value).toFixed(2)
    const sign = value >= 0 ? "+" : "-"
    const color = value >= 0 ? "text-green-600" : "text-red-600"
    return { formatted: `${sign}$${formatted}`, color }
  }

  // Generate mock projected P&L sparkline data
  const generateSparklineData = () => {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      value: Math.random() * 200 - 100
    }))
  }

  const sparklineData = generateSparklineData()

  return (
    <div 
      className="rounded-2xl p-6 border border-white/40 shadow-sm"
      style={{
        background: 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(12px)'
      }}
    >
      <div className="space-y-6">
        {/* Header */}
        <h3 className="text-lg font-semibold text-slate-900">
          Positions Management
        </h3>

        {/* Projected P&L Chart */}
        <div className="space-y-3">
          <div className="text-sm text-slate-600 font-medium">Projected P&L</div>
          
          {/* Simple sparkline using CSS */}
          <div className="h-12 relative">
            <div 
              className="w-full h-full rounded-lg opacity-60"
              style={{
                background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.3) 0%, rgba(99, 102, 241, 0.3) 50%, rgba(139, 92, 246, 0.3) 100%)',
                backdropFilter: 'blur(4px)'
              }}
            >
              {/* Overlay grid pattern */}
              <div className="absolute inset-0 opacity-20">
                {Array.from({ length: 8 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute bg-slate-400"
                    style={{
                      left: `${(i * 100) / 7}%`,
                      width: '1px',
                      height: '100%'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-between text-xs text-slate-500">
            <span>0</span>
            <span>0:00</span>
            <span>120</span>
          </div>
        </div>

        {/* Position Tabs */}
        <div className="space-y-4">
          {/* Tab Headers - Glass Style */}
          <div className="flex border-b border-white/30">
            <button
              onClick={() => setActiveTab("open")}
              className={`text-sm font-medium pb-2 px-1 border-b-2 transition-colors ${
                activeTab === "open"
                  ? "text-blue-600 border-blue-600"
                  : "text-slate-600 border-transparent hover:text-slate-800"
              }`}
            >
              Open Positions ({openPositions.length})
            </button>
            <button
              onClick={() => setActiveTab("closed")}
              className={`text-sm font-medium pb-2 px-4 ml-4 border-b-2 transition-colors ${
                activeTab === "closed"
                  ? "text-blue-600 border-blue-600"
                  : "text-slate-600 border-transparent hover:text-slate-800"
              }`}
            >
              Closed Positions
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[200px]">
            {activeTab === "open" && (
              <div>
                {openPositions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-slate-500 text-sm mb-2">No open positions</div>
                    <button className="text-blue-600 text-sm hover:text-blue-700 transition-colors">
                      Submit trades to see positions
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Position Summary */}
                    <div 
                      className="rounded-xl p-4 border border-white/40"
                      style={{
                        background: 'rgba(255, 255, 255, 0.3)',
                        backdropFilter: 'blur(8px)'
                      }}
                    >
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600">Total P&L:</span>
                          <span className={`ml-2 font-medium ${formatPL(summary.totalPL).color}`}>
                            {formatPL(summary.totalPL).formatted}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">Positions:</span>
                          <span className="ml-2 font-medium text-slate-900">{summary.totalPositions}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Long:</span>
                          <span className="ml-2 font-medium text-green-600">{summary.openBuy} MWh</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Short:</span>
                          <span className="ml-2 font-medium text-red-600">{summary.openSell} MWh</span>
                        </div>
                      </div>
                    </div>

                    {/* Position List */}
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {openPositions.map((position) => (
                        <div
                          key={position.id}
                          className="rounded-xl p-4 border border-white/40 hover:bg-white/30 transition-colors"
                          style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            backdropFilter: 'blur(6px)'
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${
                                position.side === "Buy" ? "bg-green-500" : "bg-red-500"
                              }`} />
                              <div>
                                <div className="text-sm font-medium text-slate-900">
                                  {position.side} {position.quantity} MWh
                                </div>
                                <div className="text-xs text-slate-600">
                                  Hour {position.hour} @ ${position.daLmp.toFixed(2)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-medium ${formatPL(position.livePL).color}`}>
                                {formatPL(position.livePL).formatted}
                              </div>
                              <div className="text-xs text-slate-500">
                                {position.filledIntervals}/12 filled
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "closed" && (
              <div>
                {closedPositions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-slate-500 text-sm">No closed positions</div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {closedPositions.map((position) => (
                      <div
                        key={position.id}
                        className="rounded-xl p-4 border border-white/40"
                        style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          backdropFilter: 'blur(6px)'
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-slate-400" />
                            <div>
                              <div className="text-sm font-medium text-slate-700">
                                {position.side} {position.quantity} MWh
                              </div>
                              <div className="text-xs text-slate-500">
                                Hour {position.hour} @ ${position.daLmp.toFixed(2)} • Closed
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-medium ${formatPL(position.livePL).color}`}>
                              {formatPL(position.livePL).formatted}
                            </div>
                            <div className="text-xs text-slate-500">Final P&L</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        {openPositions.length === 0 && (
          <button className="w-full py-3 text-slate-600 hover:text-slate-800 text-sm border border-white/40 rounded-xl hover:bg-white/30 transition-colors">
            Submit trades to see positions
          </button>
        )}
      </div>
    </div>
  )
}
