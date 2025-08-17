"use client"

import { useState, useEffect } from "react"
import { ConfigProvider } from "@arco-design/web-react"
import "@arco-design/web-react/dist/css/arco.css"

// New glassmorphism components
import { Toolbar } from "@/components/ui/toolbar"
import { GlassCard } from "@/components/ui/glass-card"
import { KPITile, KPIStrip } from "@/components/ui/kpi-tiles"

// Hooks
import { useTheme } from "@/hooks/use-theme"

// Legacy components (to be migrated)
import ChartsRow from "@/components/charts-row"
import LoadChart from "@/components/load-chart"
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
  const { isDarkMode, toggleTheme } = useTheme()
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

  // No need for manual theme toggle - handled by useTheme hook

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

  // Transform LMP data for KPI strip
  const kpiIntervals = lmpData.map((data, index) => {
    const time = new Date(data.timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    })
    const prevData = index > 0 ? lmpData[index - 1] : null
    const change = prevData ? data.lmp - prevData.lmp : 0
    
    return {
      time,
      value: data.lmp,
      change,
      isCurrent: index === lmpData.length - 1
    }
  })

  return (
    <ConfigProvider>
      <div className="min-h-screen bg-glass-bg">
        {/* Sticky Toolbar */}
        <Toolbar
          selectedNode={selectedNode}
          selectedDate={selectedDate}
          timezone={timezone}
          currentTime={currentTime}
          onNodeChange={setSelectedNode}
          onDateChange={handleDateChange}
          onTimezoneToggle={() => setTimezone(timezone === "UTC" ? "ET" : "UTC")}
          onTradeClick={() => setIsTradeDrawerOpen(true)}
          onThemeToggle={toggleTheme}
          isDarkMode={isDarkMode}
        />

        {/* KPI Strip */}
        <div className="sticky top-[73px] z-40 glass border-b border-glass-border/60 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-6">
              {/* Current Interval */}
              <KPITile
                title="Current Interval"
                value={`${interval.current} — ${interval.next}`}
                subtitle={`${timezone} • Next in ${60 - currentTime.getSeconds()}s`}
                size="small"
                className="min-w-[200px]"
              />

              {/* Latest LMP */}
              <KPITile
                title="Latest LMP"
                value={latestLMP?.lmp || 0}
                subtitle={latestLMP ? new Date(latestLMP.timestamp).toLocaleTimeString() : "No data"}
                isLive={!loading && !error}
                isStale={error !== null}
                size="large"
                className="min-w-[200px]"
              />
            </div>
          </div>

          {/* Last 6 Intervals Strip */}
          <div>
            <h3 className="text-14 font-medium text-muted mb-3">Last 6 Intervals</h3>
            <KPIStrip intervals={kpiIntervals} />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column - Market Intel */}
            <div className="lg:col-span-8 space-y-6">
              {/* Charts */}
              <GlassCard
                title="Market Charts"
                subtitle="Real-time and day-ahead pricing analysis"
                lastUpdated={new Date()}
              >
                <ChartsRow selectedDate={selectedDate} selectedNode={selectedNode} />
              </GlassCard>

              {/* Market Context */}
              <GlassCard
                title="Market Context & Analytics"
                subtitle="Load forecasts, fuel mix, and system conditions"
              >
                <ContextTiles selectedDate={selectedDate} selectedNode={selectedNode} />
              </GlassCard>
            </div>

            {/* Right Column - Trading & Positions */}
            <div className="lg:col-span-4 space-y-6">
              {/* Trade Ticket */}
              <GlassCard
                title="Trade Ticket"
                subtitle="Submit day-ahead orders"
                info="Orders must be submitted before 11:00 AM ET"
              >
                <TradeTicketPanel 
                  currentTime={currentTime} 
                  onTradeSubmit={handleTradeSubmit} 
                />
              </GlassCard>

              {/* Positions */}
              <GlassCard
                title="Positions Management"
                subtitle={`${positions.length} open positions`}
              >
                <PositionsTable 
                  positions={positions} 
                  currentTime={currentTime} 
                />
              </GlassCard>
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  )
}
