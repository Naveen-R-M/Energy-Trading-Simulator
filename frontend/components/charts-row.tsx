"use client"

import { useState, useEffect, useRef } from "react"
import React from "react"
import { Card, Typography, Switch, Select, Space, Tooltip } from "@arco-design/web-react"
import { IconInfoCircle } from "@arco-design/web-react/icon"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import type { LMPData } from "@/app/page"

const { Title, Text } = Typography
const { Option } = Select

interface ChartsRowProps {
  selectedDate: Date
  selectedNode: string
}

interface RTDataPoint {
  timestamp: string
  time: string
  lmp: number
  energy: number
  congestion: number
  loss: number
  hour: number
}

// Utility function to generate time range
const getTimeRange = (hours: number) => {
  const now = new Date()
  const endTime = new Date(Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000)) // Floor to 5-minute boundary
  const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000)
  
  return {
    start: startTime.toISOString(),
    end: endTime.toISOString()
  }
}

// Generate day-ahead hourly data (keeping mock for now)
const generateDayAheadData = () => {
  const data = []
  for (let hour = 0; hour < 24; hour++) {
    const basePrice = 45 + Math.sin(((hour - 6) * Math.PI) / 12) * 12
    data.push({
      hour,
      time: `${String(hour).padStart(2, "0")}:00`,
      daLmp: basePrice + Math.random() * 4 - 2,
    })
  }
  return data
}

// Generate spread data (keeping mock for now)
const generateSpreadData = () => {
  const data = []
  const currentHour = new Date().getHours()

  for (let interval = 0; interval < 12; interval++) {
    const minute = interval * 5
    const rtPrice = 50 + Math.random() * 10 - 5
    const daPrice = 48 + Math.random() * 6 - 3
    const spread = rtPrice - daPrice

    data.push({
      interval,
      time: `${String(currentHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      rtLmp: rtPrice,
      daLmp: daPrice,
      spread,
      profitable: spread > 1 ? "buy" : spread < -1 ? "sell" : "neutral",
    })
  }

  return data
}

const ChartsRow = React.memo(function ChartsRow({ selectedDate, selectedNode }: ChartsRowProps) {
  const [showComponents, setShowComponents] = useState(false)
  const [rtTimeRange, setRtTimeRange] = useState("24h")
  
  // Real-time chart data state
  const [rtData, setRtData] = useState<RTDataPoint[]>([])
  const [rtLoading, setRtLoading] = useState(true)
  const [rtError, setRtError] = useState<string | null>(null)
  const [lastRtUpdate, setLastRtUpdate] = useState<Date | null>(null)
  
  // Day-ahead chart data state
  const [daData, setDaData] = useState<any[]>([])
  const [daLoading, setDaLoading] = useState(true)
  const [daError, setDaError] = useState<string | null>(null)
  
  // Spread chart data state
  const [spreadData, setSpreadData] = useState<any[]>([])
  const [spreadLoading, setSpreadLoading] = useState(true)
  const [spreadError, setSpreadError] = useState<string | null>(null)
  const [currentHour, setCurrentHour] = useState(new Date().getHours())
  
  // Use refs to store current values for the interval callback
  const rtTimeRangeRef = useRef(rtTimeRange)
  const selectedNodeRef = useRef(selectedNode)
  
  // Update refs when values change
  useEffect(() => {
    rtTimeRangeRef.current = rtTimeRange
  }, [rtTimeRange])
  
  useEffect(() => {
    selectedNodeRef.current = selectedNode
  }, [selectedNode])

  // Fetch spread data (RT vs DA for current hour)
  const fetchSpreadData = async () => {
    try {
      setSpreadLoading(true)
      setSpreadError(null)
      
      const now = new Date()
      const hour = now.getHours()
      setCurrentHour(hour)
      
      // Create hour boundaries
      const hourStart = new Date(now)
      hourStart.setHours(hour, 0, 0, 0)
      const hourEnd = new Date(now)
      hourEnd.setHours(hour + 1, 0, 0, 0)
      
      const startStr = hourStart.toISOString()
      const endStr = hourEnd.toISOString()
      
      console.log(`🔄 Fetching spread data for hour ${hour} (${startStr} to ${endStr})`)
      
      // Fetch DA price for this hour
      const daResponse = await fetch(`/api/v1/dayahead/range?start=${startStr}&end=${endStr}&market=pjm&location=${selectedNode}`)
      if (!daResponse.ok) {
        throw new Error(`DA API error! status: ${daResponse.status}`)
      }
      const daResult = await daResponse.json()
      
      // Fetch RT prices for this hour (5-minute intervals)
      const rtResponse = await fetch(`/api/v1/realtime/range?start=${startStr}&end=${endStr}&market=pjm&location=${selectedNode}`)
      if (!rtResponse.ok) {
        throw new Error(`RT API error! status: ${rtResponse.status}`)
      }
      const rtResult = await rtResponse.json()
      
      console.log('📊 Spread API responses:', {
        daCount: daResult.data?.length,
        rtCount: rtResult.data?.length,
        hour: hour
      })
      
      if (!daResult.data || !rtResult.data) {
        throw new Error('Missing DA or RT data for spread calculation')
      }
      
      // Get DA price for this hour (should be 1 data point)
      const daPrice = daResult.data.length > 0 ? parseFloat(daResult.data[0].lmp) : null
      
      if (!daPrice) {
        throw new Error('No DA price found for current hour')
      }
      
      // Calculate spread for each RT interval in this hour
      const spreadPoints = rtResult.data.map((rtItem: any, index: number) => {
        const rtPrice = parseFloat(rtItem.lmp) || 0
        const spread = rtPrice - daPrice
        const timestamp = new Date(rtItem.interval_start_utc)
        
        return {
          interval: index,
          time: timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          rtLmp: rtPrice,
          daLmp: daPrice,
          spread: spread,
          profitable: spread > 1 ? "buy" : spread < -1 ? "sell" : "neutral",
          timestamp: rtItem.interval_start_utc
        }
      })
      
      console.log('✅ Calculated spread data:', {
        count: spreadPoints.length,
        daPrice: daPrice,
        spreadRange: {
          min: Math.min(...spreadPoints.map(d => d.spread)).toFixed(2),
          max: Math.max(...spreadPoints.map(d => d.spread)).toFixed(2),
          avg: (spreadPoints.reduce((sum, d) => sum + d.spread, 0) / spreadPoints.length).toFixed(2)
        }
      })
      
      setSpreadData(spreadPoints)
      setSpreadLoading(false)
      
    } catch (error) {
      console.error(`❌ Failed to fetch spread data:`, error)
      setSpreadError(error instanceof Error ? error.message : 'Unknown error occurred')
      setSpreadLoading(false)
    }
  }
  const fetchDayAheadData = async (date: Date) => {
    try {
      setDaLoading(true)
      setDaError(null)
      
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
      const apiUrl = `/api/v1/dayahead/date/${dateStr}?market=pjm&location=${selectedNode}`
      
      console.log(`📅 Fetching DA data for ${dateStr}:`, apiUrl)
      
      const response = await fetch(apiUrl)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('📊 DA response:', {
        dataCount: result.data?.length,
        date: dateStr,
        firstItem: result.data?.[0],
        lastItem: result.data?.[result.data?.length - 1]
      })
      
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid DA data format received from backend')
      }
      
      // Transform backend data to chart format
      const transformedDaData = result.data.map((item: any) => {
        const timestamp = new Date(item.interval_start_utc)
        const hour = timestamp.getHours()
        
        return {
          hour,
          time: `${String(hour).padStart(2, '0')}:00`,
          daLmp: parseFloat(item.lmp) || 0,
          timestamp: item.interval_start_utc
        }
      })
      
      console.log('✅ Transformed DA data:', {
        count: transformedDaData.length,
        priceRange: {
          min: Math.min(...transformedDaData.map(d => d.daLmp)).toFixed(2),
          max: Math.max(...transformedDaData.map(d => d.daLmp)).toFixed(2),
          avg: (transformedDaData.reduce((sum, d) => sum + d.daLmp, 0) / transformedDaData.length).toFixed(2)
        }
      })
      
      setDaData(transformedDaData)
      setDaLoading(false)
      
    } catch (error) {
      console.error(`❌ Failed to fetch DA data:`, error)
      setDaError(error instanceof Error ? error.message : 'Unknown error occurred')
      setDaLoading(false)
    }
  }
  const fetchRealTimeData = async (timeRange: string) => {
    try {
      setRtLoading(true)
      setRtError(null)
      
      let apiUrl: string
      
      if (timeRange === "24h") {
        // Use the optimized 24h endpoint
        apiUrl = `/api/v1/realtime/last24h?market=pjm&location=${selectedNode}`
      } else {
        // Use range endpoint for custom time windows
        const hours = timeRange === "1h" ? 1 : timeRange === "6h" ? 6 : 24
        const { start, end } = getTimeRange(hours)
        apiUrl = `/api/v1/realtime/range?start=${start}&end=${end}&market=pjm&location=${selectedNode}`
      }
      
      console.log(`🔄 Fetching RT data for ${timeRange}:`, apiUrl)
      
      const response = await fetch(apiUrl)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log(`📊 RT ${timeRange} response:`, {
        dataCount: result.data?.length,
        timeRange: timeRange,
        firstItem: result.data?.[0],
        lastItem: result.data?.[result.data?.length - 1]
      })
      
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid RT data format received from backend')
      }
      
      // Transform backend data to chart format
      const transformedRtData: RTDataPoint[] = result.data.map((item: any) => {
        const timestamp = new Date(item.interval_start_utc)
        
        return {
          timestamp: item.interval_start_utc,
          time: timestamp.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          lmp: parseFloat(item.lmp) || 0,
          energy: parseFloat(item.energy) || 0,
          congestion: parseFloat(item.congestion) || 0,
          loss: parseFloat(item.loss) || 0,
          hour: timestamp.getHours()
        }
      })
      
      console.log(`✅ Transformed RT data (${timeRange}):`, {
        count: transformedRtData.length,
        priceRange: {
          min: Math.min(...transformedRtData.map(d => d.lmp)).toFixed(2),
          max: Math.max(...transformedRtData.map(d => d.lmp)).toFixed(2),
          avg: (transformedRtData.reduce((sum, d) => sum + d.lmp, 0) / transformedRtData.length).toFixed(2)
        }
      })
      
      setRtData(transformedRtData)
      setLastRtUpdate(new Date())
      setRtLoading(false)
      
    } catch (error) {
      console.error(`❌ Failed to fetch RT data for ${timeRange}:`, error)
      setRtError(error instanceof Error ? error.message : 'Unknown error occurred')
      setRtLoading(false)
    }
  }
  
  // Fetch RT data when component mounts or time range changes
  useEffect(() => {
    fetchRealTimeData(rtTimeRange)
  }, [rtTimeRange, selectedNode])
  
  // Fetch DA data when date or node changes
  useEffect(() => {
    fetchDayAheadData(selectedDate)
  }, [selectedDate, selectedNode])
  
  // Fetch spread data when component mounts or node changes
  useEffect(() => {
    fetchSpreadData()
  }, [selectedNode])
  
  // Auto-refresh spread data every hour (when hour changes)
  useEffect(() => {
    const interval = setInterval(() => {
      const newHour = new Date().getHours()
      if (newHour !== currentHour) {
        console.log(`🔄 Hour changed to ${newHour}, refreshing spread data...`)
        fetchSpreadData()
      }
    }, 60 * 1000) // Check every minute for hour change
    
    return () => clearInterval(interval)
  }, [currentHour])
  
  // Auto-refresh latest data every 5 minutes + 40 seconds (5:40 cycle)
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentTimeRange = rtTimeRangeRef.current
      const currentNode = selectedNodeRef.current
      
      console.log(`🔄 Auto-refreshing RT data (${currentTimeRange})...`)
      
      if (currentTimeRange === "24h") {
        // For 24h view, get full dataset
        await fetchRealTimeData(currentTimeRange)
      } else {
        // For shorter ranges, append just the latest point
        try {
          console.log('🔍 Fetching latest RT point...')
          const response = await fetch(`/api/v1/realtime/latest?market=pjm&location=${currentNode}`)
          const result = await response.json()
          
          if (result.data && result.data.length > 0) {
            const latestItem = result.data[0]
            const newPoint: RTDataPoint = {
              timestamp: latestItem.interval_start_utc,
              time: new Date(latestItem.interval_start_utc).toLocaleTimeString('en-US', {
                hour12: false, hour: '2-digit', minute: '2-digit'
              }),
              lmp: parseFloat(latestItem.lmp) || 0,
              energy: parseFloat(latestItem.energy) || 0,
              congestion: parseFloat(latestItem.congestion) || 0,
              loss: parseFloat(latestItem.loss) || 0,
              hour: new Date(latestItem.interval_start_utc).getHours()
            }
            
            setRtData(prevData => {
              // Check if this point already exists
              const exists = prevData.some(point => point.timestamp === newPoint.timestamp)
              if (!exists) {
                console.log('➕ Appending new RT data point:', newPoint)
                // Add new point and keep within time window
                const timeLimit = currentTimeRange === "1h" ? 12 : currentTimeRange === "6h" ? 72 : 288
                return [...prevData.slice(-(timeLimit - 1)), newPoint]
              }
              return prevData
            })
            
            setLastRtUpdate(new Date())
          }
        } catch (error) {
          console.error('❌ Failed to fetch latest RT point:', error)
        }
      }
    }, (5 * 60 + 40) * 1000) // 5 minutes 40 seconds
    
    return () => clearInterval(interval)
  }, []) // Empty dependency array - interval runs independently

  // No more mock data - all charts use real APIs now

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: ${entry.value?.toFixed(2)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const SpreadTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <p style={{ color: "#2563eb" }}>RT LMP: ${data?.rtLmp?.toFixed(2)}</p>
          <p style={{ color: "#dc2626" }}>DA LMP: ${data?.daLmp?.toFixed(2)}</p>
          <p style={{ color: data?.spread > 0 ? "#16a34a" : "#dc2626" }}>Spread: ${data?.spread?.toFixed(2)}</p>
          <p className="text-sm text-gray-600">
            Signal: {data?.profitable === "buy" ? "Buy DA" : data?.profitable === "sell" ? "Sell DA" : "Neutral"}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Real-Time 5-minute Price Chart */}
      <Card className="col-span-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Title level={5} className="mb-0">
              Real-Time 5-min LMP
            </Title>
            <Tooltip content="5-minute real-time locational marginal pricing with live data">
              <IconInfoCircle className="text-gray-400 text-sm" />
            </Tooltip>
            {lastRtUpdate && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span>Live • {lastRtUpdate.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
          <Space>
            <Select 
              value={rtTimeRange} 
              onChange={(value) => {
                setRtTimeRange(value)
                console.log(`🔄 Time range changed to: ${value}`)
              }} 
              size="small" 
              style={{ width: 80 }}
              loading={rtLoading}
            >
              <Option value="1h">1h</Option>
              <Option value="6h">6h</Option>
              <Option value="24h">24h</Option>
            </Select>
            <Switch
              size="small"
              checked={showComponents}
              onChange={setShowComponents}
              checkedText="Components"
              uncheckedText="LMP Only"
            />
          </Space>
        </div>

        <div className="h-64">
          {rtLoading ? (
            // Loading state
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <Text className="text-sm text-gray-500">Loading {rtTimeRange} data...</Text>
              </div>
            </div>
          ) : rtError ? (
            // Error state
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Text className="text-sm text-red-500 mb-2">❌ Error: {rtError}</Text>
                <button 
                  onClick={() => fetchRealTimeData(rtTimeRange)}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : rtData.length === 0 ? (
            // No data state
            <div className="flex items-center justify-center h-full">
              <Text className="text-sm text-gray-500">No data available for {rtTimeRange}</Text>
            </div>
          ) : (
            // Chart with real data
            <ResponsiveContainer width="100%" height="100%">
              {showComponents ? (
                <AreaChart data={rtData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 10 }} 
                    interval="preserveStartEnd" 
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="energy"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                    name="Energy"
                  />
                  <Area
                    type="monotone"
                    dataKey="congestion"
                    stackId="1"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.6}
                    name="Congestion"
                  />
                  <Area
                    type="monotone"
                    dataKey="loss"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.6}
                    name="Loss"
                  />
                </AreaChart>
              ) : (
                <LineChart data={rtData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 10 }} 
                    interval="preserveStartEnd" 
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="lmp" 
                    stroke="#2563eb" 
                    strokeWidth={2} 
                    dot={false} 
                    name="LMP" 
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-3 flex justify-between text-sm text-gray-600">
          <span>Current: ${rtData.length > 0 ? rtData[rtData.length - 1]?.lmp.toFixed(2) : '--'}</span>
          <span>{rtTimeRange} Avg: ${rtData.length > 0 ? (rtData.reduce((sum, d) => sum + d.lmp, 0) / rtData.length).toFixed(2) : '--'}</span>
          <span>Peak: ${rtData.length > 0 ? Math.max(...rtData.map((d) => d.lmp)).toFixed(2) : '--'}</span>
          {rtData.length > 0 && (
            <span className="text-xs">
              Data points: {rtData.length} • Range: {rtTimeRange}
            </span>
          )}
        </div>
      </Card>

      {/* Day-Ahead Curve Chart */}
      <Card className="col-span-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Title level={5} className="mb-0">
              Day-Ahead Curve
            </Title>
            <Tooltip content="Hourly day-ahead LMP prices for selected operating day">
              <IconInfoCircle className="text-gray-400 text-sm" />
            </Tooltip>
          </div>
          <Text className="text-sm text-gray-500">{selectedDate.toLocaleDateString()}</Text>
        </div>

        <div className="h-64">
          {daLoading ? (
            // Loading state
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
                <Text className="text-sm text-gray-500">Loading day-ahead data...</Text>
              </div>
            </div>
          ) : daError ? (
            // Error state
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Text className="text-sm text-red-500 mb-2">❌ Error: {daError}</Text>
                <button 
                  onClick={() => fetchDayAheadData(selectedDate)}
                  className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : daData.length === 0 ? (
            // No data state
            <div className="flex items-center justify-center h-full">
              <Text className="text-sm text-gray-500">No day-ahead data for {selectedDate.toLocaleDateString()}</Text>
            </div>
          ) : (
            // Chart with real DA data
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line
                  type="stepAfter"
                  dataKey="daLmp"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={{ fill: "#dc2626", strokeWidth: 2, r: 3 }}
                  name="DA LMP"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-3 flex justify-between text-sm text-gray-600">
          {daData.length > 0 ? (
            <>
              <span>Peak Hour: {daData.reduce((max, d) => (d.daLmp > max.daLmp ? d : max)).hour}:00</span>
              <span>
                Off-Peak Avg: $
                {(daData.filter((d) => d.hour < 7 || d.hour > 22).reduce((sum, d) => sum + d.daLmp, 0) /
                  Math.max(1, daData.filter((d) => d.hour < 7 || d.hour > 22).length)).toFixed(2)}
              </span>
              <span>
                On-Peak Avg: $
                {(daData.filter((d) => d.hour >= 7 && d.hour <= 22).reduce((sum, d) => sum + d.daLmp, 0) /
                  Math.max(1, daData.filter((d) => d.hour >= 7 && d.hour <= 22).length)).toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-gray-400">No statistics available</span>
          )}
        </div>
      </Card>

      {/* Day-Ahead vs Real-Time Spread Chart */}
      <Card className="col-span-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Title level={5} className="mb-0">
              RT vs DA Spread
            </Title>
            <Tooltip content="Real-time minus day-ahead spread for current hour with trading signals">
              <IconInfoCircle className="text-gray-400 text-sm" />
            </Tooltip>
          </div>
          <Text className="text-sm text-gray-500">Hour {currentHour}</Text>
        </div>

        <div className="h-64">
          {spreadLoading ? (
            // Loading state
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
                <Text className="text-sm text-gray-500">Loading spread data...</Text>
              </div>
            </div>
          ) : spreadError ? (
            // Error state
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Text className="text-sm text-red-500 mb-2">❌ Error: {spreadError}</Text>
                <button 
                  onClick={() => fetchSpreadData()}
                  className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : spreadData.length === 0 ? (
            // No data state
            <div className="flex items-center justify-center h-full">
              <Text className="text-sm text-gray-500">No spread data for hour {currentHour}</Text>
            </div>
          ) : (
            // Chart with real spread data
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spreadData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip content={<SpreadTooltip />} />
                <Line
                  type="monotone"
                  dataKey="spread"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={(props: any) => {
                    const { payload, key, ...restProps } = props
                    const color = payload.spread > 1 ? "#16a34a" : payload.spread < -1 ? "#dc2626" : "#6b7280"
                    return <circle key={key} {...restProps} fill={color} stroke={color} strokeWidth={2} r={4} />
                  }}
                  name="Spread"
                />
                {/* Zero line */}
                <Line
                  type="monotone"
                  dataKey={() => 0}
                  stroke="#6b7280"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Zero"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-3">
          {spreadData.length > 0 ? (
            <>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">
                  Current Spread: ${spreadData[spreadData.length - 1]?.spread.toFixed(2)}
                </span>
                <span className="text-gray-600">
                  Avg: ${(spreadData.reduce((sum, d) => sum + d.spread, 0) / spreadData.length).toFixed(2)}
                </span>
                <span className="text-gray-600">
                  DA Price: ${spreadData[0]?.daLmp.toFixed(2)}
                </span>
              </div>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Buy DA Signal (&gt;$1)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Sell DA Signal (&lt;-$1)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span>Neutral</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 text-sm">
              No spread statistics available
            </div>
          )}
        </div>
      </Card>
    </div>
  )
})

export default ChartsRow
