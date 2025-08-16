"use client"

import { useState } from "react"
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

// Mock load data
const generateLoadData = () => {
  const data = []
  for (let hour = 0; hour < 24; hour++) {
    const baseLoad = 25000 + Math.sin(((hour - 6) * Math.PI) / 12) * 8000
    const forecast = baseLoad + Math.random() * 2000 - 1000
    const actual = baseLoad + Math.random() * 3000 - 1500

    data.push({
      hour,
      time: `${String(hour).padStart(2, "0")}:00`,
      forecast: Math.max(0, forecast),
      actual: Math.max(0, actual),
      difference: actual - forecast,
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

export default function ContextTiles() {
  const [isExpanded, setIsExpanded] = useState(false)

  const loadData = generateLoadData()
  const fuelMixData = generateFuelMixData()

  const LoadTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">Hour {label}</p>
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

  return (
    <Card className="mt-4">
      <div className="bg-transparent">
        <div
          className="flex items-center justify-between cursor-pointer p-2 hover:bg-gray-50 rounded"
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
                <Title level={6} className="mb-4">
                  Load: Actual vs Forecast
                </Title>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={loadData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={2} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <RechartsTooltip content={<LoadTooltip />} />
                      <Legend />
                      <Bar dataKey="forecast" fill="#94a3b8" name="Forecast" />
                      <Bar dataKey="actual" fill="#3b82f6" name="Actual" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 text-sm text-gray-600">
                  <Space>
                    <span>Peak Load: {Math.max(...loadData.map((d) => d.actual)).toFixed(0)} MW</span>
                    <span>
                      Forecast Error: ±
                      {(loadData.reduce((sum, d) => sum + Math.abs(d.difference), 0) / loadData.length).toFixed(0)} MW
                    </span>
                  </Space>
                </div>
              </Card>

              {/* Fuel Mix */}
              <Card>
                <Title level={6} className="mb-4">
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
                <div className="mt-3 text-sm text-gray-600">
                  <Text>
                    Marginal fuel: {fuelMixData[0].name} ({fuelMixData[0].value}%)
                  </Text>
                </div>
              </Card>
            </div>

            {/* Additional Context Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Card className="bg-blue-50">
                <div className="text-center">
                  <Text className="text-sm text-gray-600 block">System Conditions</Text>
                  <Text className="text-lg font-semibold text-blue-700">Normal</Text>
                  <Text className="text-xs text-gray-500">No alerts active</Text>
                </div>
              </Card>

              <Card className="bg-green-50">
                <div className="text-center">
                  <Text className="text-sm text-gray-600 block">Reserve Margin</Text>
                  <Text className="text-lg font-semibold text-green-700">12.5%</Text>
                  <Text className="text-xs text-gray-500">Above minimum</Text>
                </div>
              </Card>

              <Card className="bg-yellow-50">
                <div className="text-center">
                  <Text className="text-sm text-gray-600 block">Transmission</Text>
                  <Text className="text-lg font-semibold text-yellow-700">2 Constraints</Text>
                  <Text className="text-xs text-gray-500">Minor congestion</Text>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
