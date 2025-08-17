"use client"

import { useState, useEffect } from "react"
import { ConfigProvider } from "@arco-design/web-react"
import "@arco-design/web-react/dist/css/arco.css"

// New glassmorphism components
import { Toolbar } from "@/components/ui/toolbar"
import { GlassCard } from "@/components/ui/glass-card"

// Hooks
import { useTheme } from "@/hooks/use-theme"

// Legacy components (using existing charts)
import ChartsRow from "@/components/charts-row"
import ContextTiles from "@/components/context-tiles"
import TradeTicketPanel from "@/components/trade-ticket-panel"
import PositionsTable from "@/components/positions-table"

// Mock data types
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

export default function EnergyTradingApp() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedNode, setSelectedNode] = useState("PJM-RTO")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [timezone, setTimezone] = useState<"UTC" | "ET">("ET")
  const [lmpData, setLmpData] = useState<LMPData[]>([])
  const [positions, setPositions] = useState<TradePosition[]>([])
  const [isTradeDrawerOpen, setIsTradeDrawerOpen] = useState(false)

  // Add loading and error states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Force light theme on mount to match reference design
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Real API polling for LMP data every 5 minutes
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
        
        // Fallback to mock data if API fails
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

  const handleTradeSubmit = (trade: Omit<TradePosition, "id" | "filledIntervals" | "livePL">) => {
    const newTrade: TradePosition = {
      ...trade,
      id: Date.now().toString(),
      filledIntervals: 0,
      livePL: 0,
    }
    setPositions((prev) => [...prev, newTrade])
  }

  const handleDateChange = (date: Date) => {
    if (date instanceof Date && !isNaN(date.getTime())) {
      setSelectedDate(date)
    } else {
      console.warn('Invalid date received, using current date as fallback')
      setSelectedDate(new Date())
    }
  }

  // Calculate current interval
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
      <div className="min-h-screen" style={{ background: '#f2f5f9' }}>
        {/* Main Container */}
        <div className="glass rounded-[40px] m-6 min-h-[calc(100vh-48px)] shadow-glass-lg border border-white/60 backdrop-blur-[14px] backdrop-saturate-[140%]">
          
          {/* Header Section */}
          <div className="p-8 border-b border-white/30">
            <div className="flex items-center justify-between">
              {/* Left - Title and Controls */}
              <div className="flex items-center gap-8">
                <h1 className="text-[28px] font-bold text-ink">Virtual Energy Trading</h1>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-14 text-muted font-medium">Node</span>
                    <select 
                      value={selectedNode}
                      onChange={(e) => setSelectedNode(e.target.value)}
                      className="glass rounded-field px-3 py-1.5 text-14 font-medium text-ink border border-white/40 bg-white/30"
                    >
                      <option value="PJM-RTO">PJM-RTO</option>
                      <option value="NYISO">NYISO</option>
                      <option value="ISONE">ISO-NE</option>
                      <option value="CAISO">CAISO</option>
                      <option value="ERCOT">ERCOT</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2 text-14 text-muted">
                    <span>⌚</span>
                    <button 
                      onClick={() => setTimezone(timezone === "UTC" ? "ET" : "UTC")}
                      className="glass rounded-field px-2 py-1 text-14 font-medium text-ink border border-white/40 bg-white/30 hover:bg-white/40"
                    >
                      {timezone}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right - Trade Button */}
              <button 
                onClick={() => setIsTradeDrawerOpen(true)}
                className="bg-accent hover:bg-accent/90 text-white font-medium px-6 py-3 rounded-field shadow-glass-lg transition-all duration-200 flex items-center gap-2"
              >
                <span>+</span>
                <span>Trade</span>
              </button>
            </div>
          </div>

          {/* KPI Section */}
          <div className="p-8 border-b border-white/30">
            <div className="grid grid-cols-2 gap-8 mb-8">
              
              {/* Current Interval */}
              <div className="glass rounded-card p-6 bg-white/30 border border-white/40">
                <div className="text-14 text-muted font-medium mb-2">Current interval</div>
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-24 font-bold text-ink">
                    {interval.current}
                  </span>
                  <span className="text-24 text-muted">→</span>
                  <span className="text-24 font-bold text-ink">
                    {interval.next}
                  </span>
                  <span className="text-14 text-muted font-medium">{timezone}</span>
                </div>
              </div>

              {/* Latest LMP */}
              <div className="glass rounded-card p-6 bg-white/30 border border-white/40">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-14 text-muted font-medium">Latest LMP</div>
                  <div className="w-2 h-2 bg-buy rounded-full animate-pulse"></div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-32 font-bold text-ink tabular-nums">
                    ${latestLMP?.lmp.toFixed(2) || "52.42"}
                  </span>
                  <span className="text-14 text-buy font-medium">+Live</span>
                </div>
                <div className="text-14 text-muted">
                  {latestLMP ? new Date(latestLMP.timestamp).toLocaleTimeString() : "Last update: 1:35:00 PM"}
                </div>
              </div>
            </div>

            {/* Last 6 Intervals */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-16 font-semibold text-ink">Last 6 intervals</h3>
                <span className="text-12 text-muted">00/17/2023</span>
              </div>
              
              <div className="flex gap-3">
                {/* Mock interval chips matching the design */}
                {[
                  { time: "$47.50", label: "Latent price", value: "$47.50", change: null },
                  { time: "$47.83", label: "Previous day", value: "44.4.5%", change: null },
                  { time: "44.63", label: "Precast (0)", value: "4.0 4.5", change: null },
                  { time: "07.95", label: "700", value: null, change: null },
                  { time: "52.42", label: "Last price", value: "+5 62.42", change: "positive" }
                ].map((item, index) => (
                  <div key={index} className={`glass rounded-chip px-4 py-3 min-w-[140px] bg-white/30 border border-white/40 ${index === 4 ? 'ring-2 ring-accent/30' : ''}`}>
                    <div className="text-center">
                      <div className="text-20 font-bold text-ink tabular-nums mb-1">
                        {item.time}
                      </div>
                      <div className="text-12 text-muted font-medium">
                        {item.label}
                      </div>
                      {item.value && (
                        <div className={`text-14 font-medium ${item.change === 'positive' ? 'text-buy' : 'text-ink'}`}>
                          {item.value}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-8">
            <div className="grid grid-cols-12 gap-8">
              
              {/* Left Column - Charts & Analytics */}
              <div className="col-span-8 space-y-8">
                
                {/* Charts Section */}
                <div>
                  <ChartsRow selectedDate={selectedDate} selectedNode={selectedNode} />
                </div>

                {/* Context Analytics */}
                <div>
                  <ContextTiles selectedDate={selectedDate} selectedNode={selectedNode} />
                </div>
              </div>

              {/* Right Column - Trading */}
              <div className="col-span-4 space-y-6">
                
                {/* Trade Ticket */}
                <div className="glass rounded-card p-6 bg-white/30 border border-white/40">
                  <h3 className="text-18 font-semibold text-ink mb-4">Trade Ticket</h3>
                  <TradeTicketPanel 
                    currentTime={currentTime} 
                    onTradeSubmit={handleTradeSubmit} 
                  />
                </div>

                {/* Positions */}
                <div className="glass rounded-card p-6 bg-white/30 border border-white/40">
                  <h3 className="text-18 font-semibold text-ink mb-4">Positions Management</h3>
                  <PositionsTable 
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
