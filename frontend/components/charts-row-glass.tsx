"use client"

import { useState, useEffect, useRef } from "react"
import React from "react"
import { Select, Switch, Space } from "@arco-design/web-react"
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

const { Option } = Select

interface ChartsRowGlassProps {
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

// Keep all your existing utility functions unchanged
const getTimeRange = (hours: number) => {
  const now = new Date()
  const endTime = new Date(Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000))
  const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000)
  
  return {
    start: startTime.toISOString(),
    end: endTime.toISOString()
  }
}

const ChartsRowGlass = React.memo(function ChartsRowGlass({ selectedDate, selectedNode }: ChartsRowGlassProps) {
  const [showComponents, setShowComponents] = useState(false)
  const [rtTimeRange, setRtTimeRange] = useState("24h")
  
  // Keep all your existing state management unchanged
  const [rtData, setRtData] = useState<RTDataPoint[]>([])
  const [rtLoading, setRtLoading] = useState(true)
  const [rtError, setRtError] = useState<string | null>(null)
  const [lastRtUpdate, setLastRtUpdate] = useState<Date | null>(null)
  
  const [daData, setDaData] = useState<any[]>([])
  const [daLoading, setDaLoading] = useState(true)
  const [daError, setDaError] = useState<string | null>(null)
  
  const [spreadData, setSpreadData] = useState<any[]>([])
  const [spreadLoading, setSpreadLoading] = useState(true)
  const [spreadError, setSpreadError] = useState<string | null>(null)
  const [currentHour, setCurrentHour] = useState(new Date().getHours())
  
  const rtTimeRangeRef = useRef(rtTimeRange)
  const selectedNodeRef = useRef(selectedNode)
  
  useEffect(() => {
    rtTimeRangeRef.current = rtTimeRange
  }, [rtTimeRange])
  
  useEffect(() => {
    selectedNodeRef.current = selectedNode
  }, [selectedNode])

  // Keep all your existing fetch functions completely unchanged
  const fetchSpreadData = async () => {
    try {
      setSpreadLoading(true)
      setSpreadError(null)
      
      const now = new Date()
      const hour = now.getUTCHours()
      setCurrentHour(hour)
      
      const hourStart = new Date(now)
      hourStart.setUTCHours(hour, 0, 0, 0)
      const hourEnd = new Date(now)
      hourEnd.setUTCHours(hour + 1, 0, 0, 0)
      
      const startStr = hourStart.toISOString()
      const endStr = hourEnd.toISOString()
      
      console.log(`🔄 Fetching spread data for UTC hour ${hour}:`, {
        startStr,
        endStr,
        localHour: now.getHours(),
        utcHour: hour
      })
      
      console.log('📅 Fetching DA data for hour...')
      const daResponse = await fetch(`/api/v1/dayahead/range?start=${startStr}&end=${endStr}&market=pjm&location=${selectedNode}`)
      if (!daResponse.ok) {
        throw new Error(`DA API error! status: ${daResponse.status} - ${await daResponse.text()}`)
      }
      const daResult = await daResponse.json()
      
      console.log('🕰 Fetching RT data for hour...')
      const rtResponse = await fetch(`/api/v1/realtime/range?start=${startStr}&end=${endStr}&market=pjm&location=${selectedNode}`)
      if (!rtResponse.ok) {
        throw new Error(`RT API error! status: ${rtResponse.status} - ${await rtResponse.text()}`)
      }
      const rtResult = await rtResponse.json()
      
      console.log('📊 Spread API responses:', {
        daCount: daResult.data?.length,
        rtCount: rtResult.data?.length,
        daData: daResult.data?.[0],
        rtFirstItem: rtResult.data?.[0],
        hour: hour
      })
      
      if (!daResult.data || daResult.data.length === 0) {
        throw new Error(`No DA data found for hour ${hour}. Try a different hour or date.`)
      }
      
      if (!rtResult.data || rtResult.data.length === 0) {
        throw new Error(`No RT data found for hour ${hour}. This hour may not have current data yet.`)
      }
      
      const daPrice = parseFloat(daResult.data[0].lmp)
      
      if (!daPrice || daPrice <= 0) {
        throw new Error('Invalid DA price received from backend')
      }
      
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
        hourUTC: hour,
        spreadRange: {
          min: Math.min(...spreadPoints.map(d => d.spread)).toFixed(2),
          max: Math.max(...spreadPoints.map(d => d.spread)).toFixed(2),
          avg: (spreadPoints.reduce((sum, d) => sum + d.spread, 0) / spreadPoints.length).toFixed(2)
        },
        samplePoint: spreadPoints[0]
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
      
      const dateStr = date.toISOString().split('T')[0]
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
        apiUrl = `/api/v1/realtime/last24h?market=pjm&location=${selectedNode}`
      } else {
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
  
  // Keep all your existing useEffect hooks unchanged
  useEffect(() => {
    fetchRealTimeData(rtTimeRange)
  }, [rtTimeRange, selectedNode])
  
  useEffect(() => {
    fetchDayAheadData(selectedDate)
  }, [selectedDate, selectedNode])
  
  useEffect(() => {
    fetchSpreadData()
  }, [selectedNode])
  
  useEffect(() => {
    const interval = setInterval(() => {
      const newHour = new Date().getUTCHours()
      console.log(`🔄 Checking for hour change or refreshing spread data (current UTC hour: ${newHour})...`)
      fetchSpreadData()
    }, 10 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [selectedNode])
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentTimeRange = rtTimeRangeRef.current
      const currentNode = selectedNodeRef.current
      
      console.log(`🔄 Auto-refreshing RT data (${currentTimeRange})...`)
      
      if (currentTimeRange === "24h") {
        await fetchRealTimeData(currentTimeRange)
      } else {
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
              const exists = prevData.some(point => point.timestamp === newPoint.timestamp)
              if (!exists) {
                console.log('➕ Appending new RT data point:', newPoint)
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
    }, (5 * 60 + 40) * 1000)
    
    return () => clearInterval(interval)
  }, [])

  // Keep your existing tooltip functions
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm p-3 rounded-xl border border-white/60 shadow-lg">
          <p className="text-slate-900 font-medium text-sm">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
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
        <div className="bg-white/95 backdrop-blur-sm p-3 rounded-xl border border-white/60 shadow-lg">
          <p className="text-slate-900 font-medium text-sm">{label}</p>
          <p className="text-blue-600 text-sm">RT LMP: ${data?.rtLmp?.toFixed(2)}</p>
          <p className="text-red-600 text-sm">DA LMP: ${data?.daLmp?.toFixed(2)}</p>
          <p className={`text-sm ${data?.spread > 0 ? "text-green-600" : "text-red-600"}`}>Spread: ${data?.spread?.toFixed(2)}</p>
          <p className="text-xs text-slate-600">
            Signal: {data?.profitable === "buy" ? "Buy DA" : data?.profitable === "sell" ? "Sell DA" : "Neutral"}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Real-Time 5-minute Price Chart - Glass Style */}
      <div 
        className="col-span-1 rounded-2xl p-6 border border-white/40 shadow-sm"
        style={{
          background: 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(12px)'
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900 mb-0">
              Load Time 5-min LMP
            </h3>
          </div>
          <Space>
            <div className="glass-select">
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
            </div>
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
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <span className="text-sm text-slate-600">Loading {rtTimeRange} data...</span>
              </div>
            </div>
          ) : rtError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <span className="text-sm text-red-600">❌ Error: {rtError}</span>
                <br />
                <button 
                  onClick={() => fetchRealTimeData(rtTimeRange)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : rtData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-sm text-slate-500">No data available for {rtTimeRange}</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {showComponents ? (
                <AreaChart data={rtData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    interval="preserveStartEnd"
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="energy"
                    stackId="1"
                    stroke="#2563eb"
                    fill="#2563eb"
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    interval="preserveStartEnd"
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
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

        <div className="mt-3 flex justify-between text-sm text-slate-500">
          <span>Latest: ${rtData.length > 0 ? rtData[rtData.length - 1]?.lmp.toFixed(2) : '--'}</span>
          <span>Range: ${rtData.length > 0 ? `${Math.min(...rtData.map(d => d.lmp)).toFixed(1)} - ${Math.max(...rtData.map(d => d.lmp)).toFixed(1)}` : '--'}</span>
          {rtData.length > 0 && (
            <span className="text-xs">
              {rtData.length} pts • {rtTimeRange}
            </span>
          )}
        </div>
      </div>

      {/* Day-Ahead Curve Chart - Glass Style */}
      <div 
        className="col-span-1 rounded-2xl p-6 border border-white/40 shadow-sm"
        style={{
          background: 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(12px)'
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900 mb-0">
              Day-Ahead Curve
            </h3>
          </div>
          <span className="text-sm text-slate-600">{selectedDate instanceof Date ? selectedDate.toLocaleDateString() : 'Invalid Date'}</span>
        </div>

        <div className="h-64">
          {daLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-2"></div>
                <span className="text-sm text-slate-600">Loading day-ahead data...</span>
              </div>
            </div>
          ) : daError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <span className="text-sm text-red-600">❌ Error: {daError}</span>
                <br />
                <button 
                  onClick={() => fetchDayAheadData(selectedDate)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : daData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-sm text-slate-500">No day-ahead data for {selectedDate instanceof Date ? selectedDate.toLocaleDateString() : 'Invalid Date'}</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  interval={2}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line
                  type="stepAfter"
                  dataKey="daLmp"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: "#ef4444", strokeWidth: 2, r: 3 }}
                  name="DA LMP"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-3 flex justify-between text-sm text-slate-500">
          {daData.length > 0 ? (
            <>
              <span>Peak Hour: {daData.reduce((max, d) => (d.daLmp > max.daLmp ? d : max)).hour}:00</span>
              <span>
                Off-Peak: $
                {(daData.filter((d) => d.hour < 7 || d.hour > 22).reduce((sum, d) => sum + d.daLmp, 0) /
                  Math.max(1, daData.filter((d) => d.hour < 7 || d.hour > 22).length)).toFixed(2)}
              </span>
              <span>
                On-Peak: $
                {(daData.filter((d) => d.hour >= 7 && d.hour <= 22).reduce((sum, d) => sum + d.daLmp, 0) /
                  Math.max(1, daData.filter((d) => d.hour >= 7 && d.hour <= 22).length)).toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-slate-500">No statistics available</span>
          )}
        </div>
      </div>

      {/* RT vs DA Spread Chart - Glass Style */}
      <div 
        className="col-span-1 rounded-2xl p-6 border border-white/40 shadow-sm"
        style={{
          background: 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(12px)'
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-0">
            RT vs DA Spread
          </h3>
          <span className="text-sm text-slate-600">Hour {currentHour}</span>
        </div>

        <div className="h-64">
          {spreadLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                <span className="text-sm text-slate-600">Loading spread data...</span>
              </div>
            </div>
          ) : spreadError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <span className="text-sm text-red-600">❌ Error: {spreadError}</span>
                <br />
                <button 
                  onClick={() => fetchSpreadData()}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : spreadData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-sm text-slate-500">No spread data for hour {currentHour}</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spreadData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <RechartsTooltip content={<SpreadTooltip />} />
                <Line
                  type="monotone"
                  dataKey="spread"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={(props: any) => {
                    const { payload, key, ...restProps } = props
                    const color = payload.spread > 1 ? "#16a34a" : payload.spread < -1 ? "#ef4444" : "#64748b"
                    return <circle key={key} {...restProps} fill={color} stroke={color} strokeWidth={2} r={4} />
                  }}
                  name="Spread"
                />
                <Line
                  type="monotone"
                  dataKey={() => 0}
                  stroke="#64748b"
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
                <span className="text-slate-600">
                  Current: ${spreadData[spreadData.length - 1]?.spread.toFixed(2)}
                </span>
                <span className="text-slate-600">
                  Avg: ${(spreadData.reduce((sum, d) => sum + d.spread, 0) / spreadData.length).toFixed(2)}
                </span>
                <span className="text-slate-600">
                  DA: ${spreadData[0]?.daLmp.toFixed(2)}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Buy Signal (&gt;$1)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Sell Signal (&lt;-$1)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                  <span>Neutral</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-slate-500 text-sm">
              No spread statistics available
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default ChartsRowGlass
