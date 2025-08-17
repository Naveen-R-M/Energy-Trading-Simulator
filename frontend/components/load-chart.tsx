"use client"

import React, { useState, useEffect } from "react"
import { Card, Typography, Tooltip } from "@arco-design/web-react"
import { IconInfoCircle } from "@arco-design/web-react/icon"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

const { Title, Text } = Typography

interface LoadChartProps {
  selectedDate: Date
  selectedNode: string
}

const LoadChart = React.memo(function LoadChart({ selectedDate, selectedNode }: LoadChartProps) {
  const [loadData, setLoadData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>({})

  // Fetch load comparison data
  const fetchLoadData = async (date: Date) => {
    try {
      setLoading(true)
      setError(null)
      
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format
      const apiUrl = `/api/v1/load/comparison/${dateStr}`
      
      console.log(`📊 Fetching load data for ${dateStr}:`, apiUrl)
      
      const response = await fetch(apiUrl)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('📈 Load response:', {
        dataCount: result.data?.length,
        summary: result.summary,
        hasError: !!result.error
      })
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid load data format received from backend')
      }
      
      // Remove duplicates and transform data for chart
      const uniqueHours = new Map()
      result.data.forEach((item: any) => {
        const hour = item.hour
        if (!uniqueHours.has(hour) || uniqueHours.get(hour).actual_load_mw < item.actual_load_mw) {
          uniqueHours.set(hour, item)
        }
      })
      
      const deduplicatedData = Array.from(uniqueHours.values())
      
      // Transform data for chart (add hour labels and ensure proper formatting)
      const transformedData = deduplicatedData.map((item: any) => ({
        ...item,
        hourLabel: `${String(item.hour).padStart(2, '0')}:00`,
        // Ensure numbers are properly formatted
        actual_load_mw: item.actual_load_mw || 0,
        forecast_load_mw: item.forecast_load_mw || 0,
        error_mw: item.error_mw || 0
      })).sort((a, b) => a.hour - b.hour)  // Ensure sorted by hour
      
      console.log('✅ Load data transformed:', {
        originalCount: result.data?.length,
        deduplicatedCount: transformedData.length,
        hours: transformedData.map(d => d.hour),
        peakLoad: result.summary?.peak_load_mw,
        avgError: result.summary?.avg_forecast_error_mw,
        accuracy: result.summary?.forecast_accuracy_percent
      })
      
      // Validate we have data
      if (transformedData.length === 0) {
        throw new Error('No valid load data after deduplication')
      }
      
      setLoadData(transformedData)
      setSummary(result.summary || {})
      setLoading(false)
      
    } catch (error) {
      console.error(`❌ Failed to fetch load data:`, error)
      setError(error instanceof Error ? error.message : 'Unknown error occurred')
      setLoading(false)
    }
  }

  // Fetch load data when date changes
  useEffect(() => {
    fetchLoadData(selectedDate)
  }, [selectedDate])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg text-black">
          <p className="font-medium">Hour {label}</p>
          <p style={{ color: "#3b82f6" }}>
            Actual: {data?.actual_load_mw?.toLocaleString()} MW
          </p>
          <p style={{ color: "#6b7280" }}>
            Forecast: {data?.forecast_load_mw?.toLocaleString()} MW
          </p>
          <p style={{ color: data?.error_mw > 0 ? "#dc2626" : "#16a34a" }}>
            Error: {data?.error_mw > 0 ? "+" : ""}{data?.error_mw?.toFixed(0)} MW 
            ({((data?.error_mw / data?.forecast_load_mw) * 100)?.toFixed(1)}%)
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="w-full bg-gray-800 border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Title level={4} className="mb-0 text-white">
            Load: Actual vs Forecast
          </Title>
          <Tooltip content="Hourly actual load vs forecast with accuracy metrics">
            <IconInfoCircle className="text-gray-400 text-sm cursor-help" />
          </Tooltip>
        </div>
        <Text className="text-sm text-gray-300">
          {selectedDate.toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric', 
            year: 'numeric' 
          })}
        </Text>
      </div>

      <div className="h-80 mb-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <Text className="text-sm text-gray-400">Loading load data...</Text>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Text className="text-sm text-red-400 mb-2">❌ Error: {error}</Text>
              <button 
                onClick={() => fetchLoadData(selectedDate)}
                className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : loadData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Text className="text-sm text-gray-400">
              No load data for {selectedDate.toLocaleDateString()}
            </Text>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={loadData} 
              margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              barCategoryGap="10%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey="hourLabel" 
                tick={{ fontSize: 12, fill: '#ffffff' }} 
                axisLine={{ stroke: '#6b7280' }}
                tickLine={{ stroke: '#6b7280' }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: '#ffffff' }} 
                axisLine={{ stroke: '#6b7280' }}
                tickLine={{ stroke: '#6b7280' }}
                label={{ 
                  value: 'MW', 
                  angle: -90, 
                  position: 'insideLeft', 
                  style: { textAnchor: 'middle', fill: '#ffffff' } 
                }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ color: '#ffffff' }}
              />
              <Bar 
                dataKey="actual_load_mw" 
                fill="#3b82f6" 
                name="Actual"
                radius={[2, 2, 0, 0]}
                opacity={0.9}
              />
              <Bar 
                dataKey="forecast_load_mw" 
                fill="#6b7280" 
                name="Forecast"
                radius={[2, 2, 0, 0]}
                opacity={0.7}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary Statistics */}
      {Object.keys(summary).length > 0 && !loading && !error && (
        <div className="border-t border-gray-700 pt-4">
          <div className="flex justify-between items-center text-sm">
            <div className="text-gray-300">
              <span className="font-medium">Peak Load:</span>{' '}
              <span className="text-white">
                {Math.round(summary.peak_load_mw || 0).toLocaleString()} MW
              </span>
            </div>
            <div className="text-gray-300">
              <span className="font-medium">Forecast Error:</span>{' '}
              <span className="text-white">
                ±{Math.round(summary.avg_forecast_error_mw || 0).toLocaleString()} MW
              </span>
            </div>
            <div className="text-gray-300">
              <span className="font-medium">Accuracy:</span>{' '}
              <span className="text-white">
                {(summary.forecast_accuracy_percent || 0).toFixed(1)}%
              </span>
            </div>
          </div>
          
          {/* Enhanced Debug info */}
          <div className="mt-2 text-xs text-gray-500 space-y-1">
          <div>
            <span>Data points: {loadData.length}</span>
            <span className="mx-2">•</span>
            <span>Loading: {loading ? 'Yes' : 'No'}</span>
            <span className="mx-2">•</span>
            <span>Error: {error ? 'Yes' : 'None'}</span>
          </div>
          {loadData.length > 0 && (
          <>
            <div>Hours: [{loadData.map(d => d.hour).join(', ')}]</div>
              <div>Sample: Hour {loadData[0]?.hour} - Actual: {Math.round(loadData[0]?.actual_load_mw || 0).toLocaleString()}MW, Forecast: {Math.round(loadData[0]?.forecast_load_mw || 0).toLocaleString()}MW</div>
                <div>Peak: Hour {loadData.reduce((peak, current) => (current.actual_load_mw || 0) > (peak.actual_load_mw || 0) ? current : peak, loadData[0])?.hour} ({Math.round(loadData.reduce((peak, current) => (current.actual_load_mw || 0) > (peak.actual_load_mw || 0) ? current : peak, loadData[0])?.actual_load_mw || 0).toLocaleString()}MW)</div>
            </>
          )}
        </div>
        </div>
      )}
    </Card>
  )
})

export default LoadChart