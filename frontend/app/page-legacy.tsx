"use client"

import { useState, useEffect } from "react"
import { Layout, ConfigProvider } from "@arco-design/web-react"
import "@arco-design/web-react/dist/css/arco.css"
import MarketHeader from "@/components/market-header"
import LivePriceStrip from "@/components/live-price-strip"
import ChartsRow from "@/components/charts-row"
import LoadChart from "@/components/load-chart"
import ContextTiles from "@/components/context-tiles"
import TradeTicketPanel from "@/components/trade-ticket-panel"
import PositionsTable from "@/components/positions-table"
import SettingsPanel from "@/components/settings-panel"
import AlertsPanel from "@/components/alerts-panel"

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
  const [lmpData, setLmpData] = useState<LMPData[]>([])
  const [positions, setPositions] = useState<TradePosition[]>([])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Add loading and error states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Update current time every second (isolated to prevent chart re-renders)
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
        
        // Get last 24 hours of real-time data (288 intervals)
        const response = await fetch(`/api/v1/realtime/last24h?market=pjm&location=${selectedNode}`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        console.log('📊 Backend response structure:', {
          dataCount: result.data?.length,
          sampleItem: result.data?.[0],
          hasComponents: !!(result.data?.[0]?.energy && result.data?.[0]?.congestion && result.data?.[0]?.loss)
        })
        
        if (!result.data || !Array.isArray(result.data)) {
          throw new Error('Invalid data format received from backend')
        }
        
        // Take the last 6 intervals for the live price strip
        const last6Intervals = result.data.slice(-6)
        
        // Transform backend data to frontend format
        const transformedData: LMPData[] = last6Intervals.map((item: any) => {
          return {
            timestamp: item.interval_start_utc,
            lmp: parseFloat(item.lmp) || 0,
            energy: parseFloat(item.energy) || 0,           // ✅ Real energy component from backend
            congestion: parseFloat(item.congestion) || 0,   // ✅ Real congestion component from backend
            loss: parseFloat(item.loss) || 0,               // ✅ Real loss component from backend
          }
        })
        
        console.log('✅ Transformed data with real components:', {
          count: transformedData.length,
          latestInterval: {
            timestamp: transformedData[transformedData.length - 1]?.timestamp,
            lmp: transformedData[transformedData.length - 1]?.lmp,
            energy: transformedData[transformedData.length - 1]?.energy,
            congestion: transformedData[transformedData.length - 1]?.congestion,
            loss: transformedData[transformedData.length - 1]?.loss,
            componentsSum: (
              transformedData[transformedData.length - 1]?.energy +
              transformedData[transformedData.length - 1]?.congestion +
              transformedData[transformedData.length - 1]?.loss
            ).toFixed(2)
          }
        })
        setLmpData(transformedData)
        setLoading(false)
        
      } catch (error) {
        console.error('❌ Failed to fetch LMP data:', error)
        setError(error instanceof Error ? error.message : 'Unknown error occurred')
        
        // Fallback to mock data if API fails
        console.log('🔄 Falling back to mock data...')
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

    // Initial fetch
    fetchLMPData()
    
    // Poll every 5 minutes for new data
    const interval = setInterval(fetchLMPData, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [selectedNode]) // Re-fetch when node changes

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
    // Ensure we always set a valid Date object
    if (date instanceof Date && !isNaN(date.getTime())) {
      setSelectedDate(date)
    } else {
      console.warn('Invalid date received, using current date as fallback')
      setSelectedDate(new Date())
    }
  }

  return (
    <ConfigProvider>
      <Layout className="min-h-screen bg-background dark">
        <div className="flex flex-col">
          {/* Sticky Market Header */}
          <div className="sticky top-0 z-50 trading-header">
            <MarketHeader
              currentTime={currentTime}
              selectedNode={selectedNode}
              selectedDate={selectedDate}
              latestLMP={lmpData[lmpData.length - 1]}
              onNodeChange={setSelectedNode}
              onDateChange={handleDateChange}
              onSettingsClick={() => setIsSettingsOpen(true)}
            />
          </div>

          {/* Live Price Strip */}
          <div className="bg-card border-b border-border">
            <LivePriceStrip lmpData={lmpData} loading={loading} error={error} />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-4 space-y-4 bg-background">
            {/* Charts Row */}
            <ChartsRow selectedDate={selectedDate} selectedNode={selectedNode} />

            {/* Context Tiles (includes Load chart) */}
            <ContextTiles selectedDate={selectedDate} selectedNode={selectedNode} />

            {/* Alerts Panel */}
            {/* <AlertsPanel /> */}

            {/* Trading and Positions Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Trade Ticket Panel */}
              <div className="lg:col-span-1">
                <TradeTicketPanel currentTime={currentTime} onTradeSubmit={handleTradeSubmit} />
              </div>

              {/* Positions Table */}
              <div className="lg:col-span-2">
                <PositionsTable positions={positions} currentTime={currentTime} />
              </div>
            </div>
          </div>

          {/* Settings Panel */}
          <SettingsPanel
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            selectedNode={selectedNode}
            onNodeChange={setSelectedNode}
          />
        </div>
      </Layout>
    </ConfigProvider>
  )
}
