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

interface ContextTilesGlassProps {
  selectedDate: Date
  selectedNode: string
}

// Keep all your existing mock data generators unchanged
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
      <div className="bg-white/95 backdrop-blur-sm p-3 rounded-xl border border-white/60 shadow-lg">
        <p className="text-slate-900 font-medium text-sm">Hour {label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {entry.value?.toFixed(0)} MW
          </p>
        ))}
      </div>
    )
  }
  return null
}

const ContextTilesGlass = React.memo(function ContextTilesGlass({ selectedDate, selectedNode }: ContextTilesGlassProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [loadData, setLoadData] = useState<any[]>([])
  const [loadLoading, setLoadLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadSummary, setLoadSummary] = useState<any>({})

  // Keep all your existing fetch logic unchanged
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
        if (result.data.length === 0) {
          throw new Error('No load data points received from backend')
        }
        
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
        })).sort((a, b) => a.hour - b.hour)
        
        console.log('✅ Load data transformed:', {
          originalCount: result.data.length,
          deduplicatedCount: transformedData.length,
          hours: transformedData.map(d => d.hour),
          firstItem: transformedData[0],
          lastItem: transformedData[transformedData.length - 1],
          summary: result.summary
        })
        
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
      
      console.log('⚠️ Not using mock data - showing error state')
      setLoadData([])
    }
  }

  // Keep your existing useEffect hooks
  useEffect(() => {
    console.log('🚀 ContextTilesGlass mounting - forcing load data fetch for:', selectedDate.toISOString().split('T')[0])
    fetchLoadData(selectedDate)
  }, [selectedDate])
  
  useEffect(() => {
    console.log('🚀 ContextTilesGlass component mounted')
    fetchLoadData(selectedDate)
  }, [])

  const fuelMixData = generateFuelMixData()

  return (
    <div 
      className="rounded-2xl border border-white/30 shadow-sm"
      style={{
        background: 'rgba(255, 255, 255, 0.3)',
        backdropFilter: 'blur(12px)'
      }}
    >
      <div
        className="flex items-center justify-between cursor-pointer p-6 hover:bg-white/10 rounded-t-2xl transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-semibold text-slate-900 mb-0">
          Market Context & Analytics
        </h3>
        <IconDown className={`transition-transform text-slate-600 ${isExpanded ? "rotate-180" : ""}`} />
      </div>

      {isExpanded && (
        <div className="p-6 pt-0">
          <div className="grid grid-cols-1 gap-6 mt-4">
            {/* Load Actual vs Forecast - Glass Style */}
            <div 
              className="rounded-2xl p-6 border border-white/40 shadow-sm"
              style={{
                background: 'rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(12px)'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-slate-900 mb-0">
                  Load: Actual vs Forecast
                </h4>
                <span className="text-sm text-slate-500">
                  {selectedDate.toLocaleDateString()}
                </span>
              </div>
              <div className="h-48">
                {loadLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <span className="text-sm text-slate-600">Loading load data...</span>
                    </div>
                  </div>
                ) : loadError ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-2">
                      <span className="text-sm text-red-600">❌ Error: {loadError}</span>
                      <br />
                      <button 
                        onClick={() => fetchLoadData(selectedDate)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
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
                      <Bar dataKey="actual" fill="#2563eb" name="Actual" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="forecast" fill="#64748b" name="Forecast" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {Object.keys(loadSummary).length > 0 && (
                <div className="mt-3 flex justify-between text-xs text-slate-500">
                  <span>Peak: {Math.round(loadSummary.peak_load_mw || 0).toLocaleString()} MW</span>
                  <span>Error: ±{Math.round(loadSummary.avg_forecast_error_mw || 0)} MW</span>
                  <span>Accuracy: {(loadSummary.forecast_accuracy_percent || 0).toFixed(1)}%</span>
                </div>
              )}
              
              <div className="mt-2 text-xs text-slate-500 space-y-1">
                <div>Data points: {loadData.length} • Loading: {loadLoading ? 'Yes' : 'No'} • Error: {loadError || 'None'}</div>
                {loadData.length > 0 && (
                  <>
                    <div>Hours: [{loadData.map(d => d.hour).join(', ')}]</div>
                    <div>Sample: Hour {loadData[0]?.hour} - Actual: {loadData[0]?.actual?.toLocaleString()}MW, Forecast: {loadData[0]?.forecast?.toLocaleString()}MW</div>
                    <div>Peak Hour: {loadData.reduce((peak, current) => current.actual > peak.actual ? current : peak, loadData[0])?.hour} ({loadData.reduce((peak, current) => current.actual > peak.actual ? current : peak, loadData[0])?.actual?.toLocaleString()}MW)</div>
                  </>
                )}
              </div>
            </div>


          </div>

          {/* Additional Context Cards - Glass Style */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {[
              { title: 'System Conditions', value: 'Normal', status: 'No alerts active', color: 'text-green-600' },
              { title: 'Reserve Margin', value: '12.5%', status: 'Above minimum', color: 'text-blue-600' },
              { title: 'Transmission', value: '2 Constraints', status: 'Minor congestion', color: 'text-amber-600' }
            ].map((item, index) => (
              <div 
                key={index}
                className="rounded-2xl p-4 border border-white/40 shadow-sm text-center"
                style={{
                  background: 'rgba(255, 255, 255, 0.4)',
                  backdropFilter: 'blur(12px)'
                }}
              >
                <div className="text-sm text-slate-600 mb-1">{item.title}</div>
                <div className={`text-lg font-semibold mb-1 ${item.color}`}>{item.value}</div>
                <div className="text-xs text-slate-500">{item.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

export default ContextTilesGlass
