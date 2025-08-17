"use client"

import { useState, useEffect } from "react"
import { ConfigProvider } from "@arco-design/web-react"
import "@arco-design/web-react/dist/css/arco.css"

// Import your existing components with all backend logic preserved
import ChartsRowGlass from "@/components/charts-row-glass"
import ContextTilesGlass from "@/components/context-tiles-glass" 
import TradeTicketPanelGlass from "@/components/trade-ticket-panel-glass"
import PositionsTableGlass from "@/components/positions-table-glass"

// Keep your existing data types unchanged
export interface LMPData {
  timestamp: string
  lmp: number
  energy: number
  congestion: number
  loss: number
}

export interface TradePosition {
  id: string
  hour: number
  side: "Buy" | "Sell"
  quantity: number
  daLmp: number
  filledIntervals: number
  livePL: number
  projectedPL?: number
}

export default function EnergyTradingAppGlass() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedNode, setSelectedNode] = useState("PJM-RTO")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [timezone, setTimezone] = useState<"UTC" | "ET">("ET")
  const [lmpData, setLmpData] = useState<LMPData[]>([])
  const [positions, setPositions] = useState<TradePosition[]>([])
  const [isTradeDrawerOpen, setIsTradeDrawerOpen] = useState(false)

  // Keep all your existing state management logic
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Force light theme on mount to match glass design
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.body.style.background = 'linear-gradient(135deg, #f5f7fb 0%, #f3f6fa 100%)'
  }, [])

  // Keep your existing time update logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Keep your existing API polling logic unchanged
  useEffect(() => {
    const fetchLMPData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('🔄 Fetching real-time data from backend...')
        
        const response = await fetch(`/api/v1/realtime/last24h?market=pjm&location=${selectedNode}`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (!result.data || !Array.isArray(result.data)) {
          throw new Error('Invalid data format received from backend')
        }
        
        const last6Intervals = result.data.slice(-6)
        
        const transformedData: LMPData[] = last6Intervals.map((item: any) => {
          return {
            timestamp: item.interval_start_utc,
            lmp: parseFloat(item.lmp) || 0,
            energy: parseFloat(item.energy) || 0,
            congestion: parseFloat(item.congestion) || 0,
            loss: parseFloat(item.loss) || 0,
          }
        })
        
        setLmpData(transformedData)
        setLoading(false)
        
      } catch (error) {
        console.error('❌ Failed to fetch LMP data:', error)
        setError(error instanceof Error ? error.message : 'Unknown error occurred')
        
        // Keep your existing fallback mock data
        const mockData: LMPData[] = Array.from({ length: 6 }, (_, i) => {
          const timestamp = new Date(Date.now() - (5 - i) * 5 * 60 * 1000)
          const basePrice = 45 + Math.random() * 20
          return {
            timestamp: timestamp.toISOString(),
            lmp: basePrice,
            energy: basePrice * 0.85,
            congestion: basePrice * 0.1,
            loss: basePrice * 0.05,
          }
        })
        setLmpData(mockData)
        setLoading(false)
      }
    }

    fetchLMPData()
    const interval = setInterval(fetchLMPData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [selectedNode])

  // Keep your existing trade submit logic
  const handleTradeSubmit = (trade: Omit<TradePosition, "id" | "filledIntervals" | "livePL">) => {
    const newTrade: TradePosition = {
      ...trade,
      id: Date.now().toString(),
      filledIntervals: 0,
      livePL: 0,
    }
    setPositions((prev) => [...prev, newTrade])
  }

  // Keep your existing date change logic
  const handleDateChange = (date: Date) => {
    if (date instanceof Date && !isNaN(date.getTime())) {
      setSelectedDate(date)
    } else {
      console.warn('Invalid date received, using current date as fallback')
      setSelectedDate(new Date())
    }
  }

  // Keep your existing interval calculation
  const getCurrentInterval = () => {
    const now = currentTime
    const minutes = now.getMinutes()
    const intervalStart = Math.floor(minutes / 5) * 5
    const intervalEnd = intervalStart + 5
    return {
      current: `${String(now.getHours()).padStart(2, "0")}:${String(intervalStart).padStart(2, "0")}`,
      next: `${String(now.getHours()).padStart(2, "0")}:${String(intervalEnd).padStart(2, "0")}`,
    }
  }

  const interval = getCurrentInterval()
  const latestLMP = lmpData[lmpData.length - 1]

  return (
    <ConfigProvider>
      {/* Glass Theme Background */}
      <div 
        className="min-h-screen p-6"
        style={{
          background: 'linear-gradient(135deg, #f5f7fb 0%, #f3f6fa 100%)'
        }}
      >
        {/* Main Glass Container */}
        <div 
          className="rounded-[20px] min-h-[calc(100vh-48px)] shadow-lg border border-white/60 overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}
        >
          
          {/* Header Section - Glass Style */}
          <div className="p-8 border-b border-white/30">
            <div className="flex items-center justify-between">
              {/* Left - Title and Controls */}
              <div className="flex items-center gap-8">
                <h1 className="text-[28px] font-bold text-slate-900">Virtual Energy Trading</h1>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 font-medium">Node</span>
                    <select 
                      value={selectedNode}
                      onChange={(e) => setSelectedNode(e.target.value)}
                      className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-900 border border-white/40 bg-white/50 backdrop-blur-sm hover:bg-white/60 transition-all"
                      style={{ backdropFilter: 'blur(8px)' }}
                    >
                      <option value="PJM-RTO">PJM-RTO</option>
                      <option value="NYISO">NYISO</option>
                      <option value="ISONE">ISO-NE</option>
                      <option value="CAISO">CAISO</option>
                      <option value="ERCOT">ERCOT</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span>⌚</span>
                    <button 
                      onClick={() => setTimezone(timezone === "UTC" ? "ET" : "UTC")}
                      className="rounded-full px-3 py-1 text-sm font-medium text-slate-900 border border-white/40 bg-white/50 hover:bg-white/60 transition-all"
                      style={{ backdropFilter: 'blur(8px)' }}
                    >
                      {timezone}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right - Trade Button */}
              <button 
                onClick={() => setIsTradeDrawerOpen(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium px-6 py-3 rounded-full shadow-lg transition-all duration-200 flex items-center gap-2"
              >
                <span className="text-lg">+</span>
                <span>Trade</span>
              </button>
            </div>
          </div>

          {/* KPI Section - Glass Style */}
          <div className="p-8 border-b border-white/30">
            <div className="grid grid-cols-2 gap-8 mb-8">
              
              {/* Current Interval - Glass Card */}
              <div 
                className="rounded-2xl p-6 border border-white/40 shadow-sm"
                style={{
                  background: 'rgba(255, 255, 255, 0.4)',
                  backdropFilter: 'blur(12px)'
                }}
              >
                <div className="text-sm text-slate-600 font-medium mb-2">Current interval</div>
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {interval.current}
                  </span>
                  <span className="text-2xl text-slate-500">→</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {interval.next}
                  </span>
                  <span className="text-sm text-slate-600 font-medium">{timezone}</span>
                </div>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Last 6 intervals
                </button>
              </div>

              {/* Latest LMP - Glass Card */}
              <div 
                className="rounded-2xl p-6 border border-white/40 shadow-sm"
                style={{
                  background: 'rgba(255, 255, 255, 0.4)',
                  backdropFilter: 'blur(12px)'
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm text-slate-600 font-medium">Latest LMP</div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[32px] font-bold text-slate-900 font-mono">
                    ${latestLMP?.lmp.toFixed(2) || "52.42"}
                  </span>
                  <span className="text-sm text-green-600 font-medium">Live</span>
                </div>
                <div className="text-sm text-slate-500">
                  {latestLMP ? new Date(latestLMP.timestamp).toLocaleTimeString() : "Last techno urst"}
                </div>
              </div>
            </div>

            {/* Last 6 Intervals - Glass Tiles */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Last 6 intervals</h3>
                <span className="text-xs text-slate-500">{currentTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
              </div>
              
              <div className="flex gap-3 overflow-x-auto pb-2">
              {/* Real backend data for last 6 intervals */}
              {lmpData.map((item, index) => (
                  <div 
                    key={index}
                    className={`
                      flex-shrink-0 rounded-full px-4 py-3 min-w-[140px] border border-white/40 shadow-sm transition-all
                      ${index === lmpData.length - 1 ? 'ring-2 ring-blue-500/30' : ''}
                    `}
                    style={{
                      background: 'rgba(255, 255, 255, 0.4)',
                      backdropFilter: 'blur(12px)'
                    }}
                  >
                    <div className="text-center">
                      <div className="text-xl font-bold text-slate-900 font-mono mb-1">
                        ${item.lmp.toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-600 font-medium mb-1">
                        {new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </div>
                      <div className={`text-sm font-medium ${index === lmpData.length - 1 ? 'text-green-600' : 'text-slate-700'}`}>
                        ${item.energy.toFixed(2)} E
                      </div>
                    </div>
                  </div>
                ))}
              {/* Show loading state when no data */}
              {lmpData.length === 0 && (
                <div className="flex gap-3">
                  {[...Array(6)].map((_, index) => (
                    <div 
                      key={index}
                      className="flex-shrink-0 rounded-full px-4 py-3 min-w-[140px] border border-white/40 shadow-sm animate-pulse"
                      style={{
                        background: 'rgba(255, 255, 255, 0.4)',
                        backdropFilter: 'blur(12px)'
                      }}
                    >
                      <div className="text-center">
                        <div className="bg-slate-300 h-6 w-16 mx-auto mb-1 rounded"></div>
                        <div className="bg-slate-200 h-3 w-12 mx-auto mb-1 rounded"></div>
                        <div className="bg-slate-200 h-4 w-14 mx-auto rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-8">
            <div className="grid grid-cols-12 gap-8">
              
              {/* Left Column - Charts & Analytics */}
              <div className="col-span-8 space-y-8">
                
                {/* Charts Section - Keep your existing logic */}
                <div>
                  <ChartsRowGlass selectedDate={selectedDate} selectedNode={selectedNode} />
                </div>

                {/* Context Analytics - Keep your existing logic */}
                <div>
                  <ContextTilesGlass selectedDate={selectedDate} selectedNode={selectedNode} />
                </div>
              </div>

              {/* Right Column - Trading */}
              <div className="col-span-4 space-y-6">
                
                {/* Trade Ticket - Keep your existing logic */}
                <div>
                  <TradeTicketPanelGlass 
                    currentTime={currentTime} 
                    onTradeSubmit={handleTradeSubmit} 
                  />
                </div>

                {/* Positions - Keep your existing logic */}
                <div>
                  <PositionsTableGlass 
                    positions={positions} 
                    currentTime={currentTime} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  )
}
