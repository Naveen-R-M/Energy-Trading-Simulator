"use client"

import React, { useState, useEffect } from "react"
import { Card, Typography, Space } from "@arco-design/web-react"
import { IconDown } from "@arco-design/web-react/icon"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

const { Title, Text } = Typography

interface ContextTilesProps {
  selectedDate: Date
  selectedNode: string
}

// Mock load data
const generateMockLoadData = () => {
  const data = []
  for (let hour = 0; hour < 24; hour++) {
    const baseLoad = 25000 + Math.sin(((hour - 6) * Math.PI) / 12) * 8000
    const forecast = baseLoad + Math.random() * 2000 - 1000
    const actual = baseLoad + Math.random() * 3000 - 1500

    data.push({
      hour,
      time: `${String(hour).padStart(2, "0")}:00`,
      forecast: Math.max(0, Math.round(forecast)),
      actual: Math.max(0, Math.round(actual)),
      difference: Math.round(actual - forecast),
    })
  }
  return data
}

// Mock fuel mix data
const generateFuelMixData = () => [
  { name: "Natural Gas", value: 42, color: "#3b82f6" },
  { name: "Nuclear", value: 28, color: "#10b981" },
  { name: "Coal", value: 15, color: "#6b7280" },
  { name: "Renewables", value: 12, color: "#f59e0b" },
  { name: "Hydro", value: 3, color: "#06b6d4" },
]

const LoadTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg text-gray-900">
        <p className="font-medium text-gray-900">Hour {label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toFixed(0)} MW
          </p>
        ))}
      </div>
    )
  }
  return null
}

const ContextTiles = React.memo(function ContextTiles({ selectedDate, selectedNode }: ContextTilesProps) {
  const [isExpanded, setIsExpanded] = useState(true) // Start expanded to show the chart
  const [loadData, setLoadData] = useState<any[]>([])
  const [loadLoading, setLoadLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadSummary, setLoadSummary] = useState<any>({})

  const fetchLoadData = async (date: Date) => {
    try {
      setLoadLoading(true)
      setLoadError(null)
      
      const dateStr = date.toISOString().split('T')[0]
      const apiUrl = `/api/v1/load/comparison/${dateStr}?market=pjm`
      
      console.log('📊 Fetching REAL load data:', {
        date: dateStr,
        url: apiUrl
      })
      
      const response = await fetch(apiUrl)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }
      
      const result = await response.json()
      
      console.log('📊 Load API response:', {
        hasData: !!result.data,
        dataLength: result.data?.length,
        hasSummary: !!result.summary,
        hasError: !!result.error,
        sampleData: result.data?.[0]
      })
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      if (result.data && Array.isArray(result.data)) {
        // Check if we have valid data
        if (result.data.length === 0) {
          throw new Error('No load data points received from backend')
        }
        
        // Remove duplicates by hour and transform for chart display
        const uniqueHours = new Map()
        result.data.forEach((item: any) => {
          const hour = item.hour
          if (!uniqueHours.has(hour) || uniqueHours.get(hour).actual_load_mw < item.actual_load_mw) {
            uniqueHours.set(hour, item)
          }
        })
        
        const deduplicatedData = Array.from(uniqueHours.values())
        
        const transformedData = deduplicatedData.map((item: any) => ({
          hour: item.hour,
          time: `${String(item.hour).padStart(2, '0')}:00`,
          actual: Math.round(item.actual_load_mw || 0),
          forecast: Math.round(item.forecast_load_mw || 0),
          difference: Math.round(item.error_mw || 0)
        })).sort((a, b) => a.hour - b.hour)  // Ensure sorted by hour
        
        console.log('✅ Load data transformed:', {
          originalCount: result.data.length,
          deduplicatedCount: transformedData.length,
          hours: transformedData.map(d => d.hour),
          firstItem: transformedData[0],
          lastItem: transformedData[transformedData.length - 1],
          summary: result.summary
        })
        
        // Validate we have proper 24-hour data
        if (transformedData.length === 0) {
          throw new Error('No valid load data after deduplication')
        }
        
        setLoadData(transformedData)
        setLoadSummary(result.summary || {})
      } else {
        throw new Error('No load data received from backend')
      }
      
      setLoadLoading(false)
      
    } catch (error) {
      console.error('❌ Failed to fetch load data:', error)
      setLoadError(error instanceof Error ? error.message : 'Unknown error')
      setLoadLoading(false)
      
      // DO NOT fallback to mock - show error instead
      console.log('⚠️ Not using mock data - showing error state')
      setLoadData([])
    }
  }

  // Fetch when date changes - force immediate fetch on mount
  useEffect(() => {
    console.log('🚀 ContextTiles mounting - forcing load data fetch for:', selectedDate.toISOString().split('T')[0])
    fetchLoadData(selectedDate)
  }, [selectedDate])
  
  // Also fetch on component mount
  useEffect(() => {
    console.log('🚀 ContextTiles component mounted')
    fetchLoadData(selectedDate)
  }, [])

  const fuelMixData = generateFuelMixData()

  return (
    <Card className="mt-4">
      <div className="bg-transparent">
        <div
          className="flex items-center justify-between cursor-pointer p-2 hover:bg-muted/20 rounded"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Title level={6} className="mb-0">
            Market Context & Analytics
          </Title>
          <IconDown className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </div>

        {isExpanded && (
          <div className="pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              {/* Load Actual vs Forecast */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <Title level={6} className="mb-0 text-ink">
                    Load: Actual vs Forecast
                  </Title>
                  <span className="text-14 text-muted">
                    {selectedDate.toLocaleDateString()}
                  </span>
                </div>
                <div className="h-48">
                  {loadLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent mx-auto mb-2"></div>
                        <span className="text-12 text-muted">Loading load data...</span>
                      </div>
                    </div>
                  ) : loadError ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <span className="text-12 text-red-600 mb-2">Error: {loadError}</span>
                        <button 
                          onClick={() => fetchLoadData(selectedDate)}
                          className="px-2 py-1 bg-accent text-white rounded text-12 hover:bg-accent/90"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={loadData}>
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
                          label={{ value: 'MW', angle: -90, position: 'insideLeft', style: { fill: '#64748b' } }}
                        />
                        <RechartsTooltip content={<LoadTooltip />} />
                        <Legend />
                        <Bar dataKey="actual" fill="#4f46e5" name="Actual" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="forecast" fill="#64748b" name="Forecast" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {Object.keys(loadSummary).length > 0 && (
                  <div className="mt-3 flex justify-between text-12 text-muted">
                    <span>Peak Load: {Math.round(loadSummary.peak_load_mw || 0).toLocaleString()} MW</span>
                    <span>Forecast Error: ±{Math.round(loadSummary.avg_forecast_error_mw || 0)} MW</span>
                    <span>Accuracy: {(loadSummary.forecast_accuracy_percent || 0).toFixed(1)}%</span>
                  </div>
                )}
                
                {/* Enhanced Debug info */}
                <div className="mt-2 text-12 text-muted space-y-1">
                  <div>Data points: {loadData.length} • Loading: {loadLoading ? 'Yes' : 'No'} • Error: {loadError || 'None'}</div>
                  {loadData.length > 0 && (
                    <>
                      <div>Hours: [{loadData.map(d => d.hour).join(', ')}]</div>
                      <div>Sample: Hour {loadData[0]?.hour} - Actual: {loadData[0]?.actual?.toLocaleString()}MW, Forecast: {loadData[0]?.forecast?.toLocaleString()}MW</div>
                      <div>Peak Hour: {loadData.reduce((peak, current) => current.actual > peak.actual ? current : peak, loadData[0])?.hour} ({loadData.reduce((peak, current) => current.actual > peak.actual ? current : peak, loadData[0])?.actual?.toLocaleString()}MW)</div>
                    </>
                  )}
                </div>
              </Card>

              {/* Fuel Mix */}
              <Card className="glass rounded-card p-6 bg-white/30 border border-white/40">
                <Title level={6} className="mb-4 text-ink">
                  Current Fuel Mix
                </Title>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fuelMixData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {fuelMixData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value: any) => [`${value}%`, "Share"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 text-14 text-muted">
                  <span className="text-ink">
                    Marginal fuel: {fuelMixData[0].name} ({fuelMixData[0].value}%)
                  </span>
                </div>
              </Card>
            </div>

            {/* Additional Context Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Card className="glass rounded-card p-4 bg-white/30 border border-white/40">
                <div className="text-center">
                  <span className="text-14 text-muted block">System Conditions</span>
                  <span className="text-18 font-semibold text-accent">Normal</span>
                  <span className="text-12 text-muted">No alerts active</span>
                </div>
              </Card>
              <Card className="glass rounded-card p-4 bg-white/30 border border-white/40">
                <div className="text-center">
                  <span className="text-14 text-muted block">Reserve Margin</span>
                  <span className="text-18 font-semibold text-buy">12.5%</span>
                  <span className="text-12 text-muted">Above minimum</span>
                </div>
              </Card>
              <Card className="glass rounded-card p-4 bg-white/30 border border-white/40">
                <div className="text-center">
                  <span className="text-14 text-muted block">Transmission</span>
                  <span className="text-18 font-semibold text-warning">2 Constraints</span>
                  <span className="text-12 text-muted">Minor congestion</span>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
})

export default ContextTiles
