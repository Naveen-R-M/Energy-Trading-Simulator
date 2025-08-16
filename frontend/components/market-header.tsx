"use client"

import { Card, Select, DatePicker, Badge, Button, Space, Typography, Tooltip } from "@arco-design/web-react"
import { IconSettings, IconRefresh, IconInfoCircle } from "@arco-design/web-react/icon"
import type { LMPData } from "@/app/page"

const { Text, Title } = Typography
const { Option } = Select

interface MarketHeaderProps {
  currentTime: Date
  selectedNode: string
  selectedDate: Date
  latestLMP?: LMPData
  onNodeChange: (node: string) => void
  onDateChange: (date: Date) => void
  onSettingsClick: () => void
}

export default function MarketHeader({
  currentTime,
  selectedNode,
  selectedDate,
  latestLMP,
  onNodeChange,
  onDateChange,
  onSettingsClick,
}: MarketHeaderProps) {
  const utcTime = currentTime.toISOString().slice(11, 19)
  const etTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(currentTime)

  // Calculate current 5-minute interval
  const minutes = currentTime.getMinutes()
  const intervalStart = Math.floor(minutes / 5) * 5
  const intervalEnd = intervalStart + 5
  const currentInterval = `${String(currentTime.getHours()).padStart(2, "0")}:${String(intervalStart).padStart(2, "0")}–${String(currentTime.getHours()).padStart(2, "0")}:${String(intervalEnd).padStart(2, "0")} UTC`

  // Countdown to next interval
  const secondsToNext = (5 - (minutes % 5)) * 60 - currentTime.getSeconds()
  const countdownMinutes = Math.floor(secondsToNext / 60)
  const countdownSeconds = secondsToNext % 60

  const dataAge = latestLMP ? (Date.now() - new Date(latestLMP.timestamp).getTime()) / 1000 / 60 : 10
  const getDataStatus = () => {
    if (dataAge < 2) return { status: "success" as const, text: "Live", color: "text-positive" }
    if (dataAge < 6) return { status: "warning" as const, text: "Delayed", color: "text-warning" }
    return { status: "error" as const, text: "Stale", color: "text-negative" }
  }
  const dataStatus = getDataStatus()

  const priceChange = latestLMP ? Math.random() * 4 - 2 : 0 // Mock price change
  const priceChangeColor =
    priceChange > 0 ? "text-positive" : priceChange < 0 ? "text-negative" : "text-muted-foreground"

  return (
    <Card className="rounded-none border-0 shadow-lg bg-gradient-to-r from-card via-card to-card/95 backdrop-blur-sm border-b border-border/50">
      <div className="flex flex-wrap items-center justify-between gap-6 py-2">
        {/* Time and Interval Info */}
        <div className="flex items-center gap-8">
          <div className="space-y-1">
            <Title level={4} className="mb-0 text-foreground font-light tracking-wide">
              Virtual Energy Trading
            </Title>
            <Space size="large" className="mt-2">
              <div className="text-center px-3 py-1 rounded-md bg-background/50 border border-border/30">
                <Text className="text-xs text-muted-foreground block font-medium">UTC</Text>
                <Text className="text-lg font-mono font-bold text-accent tracking-wider">{utcTime}</Text>
              </div>
              <div className="text-center px-3 py-1 rounded-md bg-background/50 border border-border/30">
                <Text className="text-xs text-muted-foreground block font-medium">ET</Text>
                <Text className="text-lg font-mono font-bold text-accent tracking-wider">{etTime}</Text>
              </div>
            </Space>
          </div>

          <div className="border-l border-border/40 pl-8 space-y-2">
            <div className="flex items-center gap-2">
              <Text className="text-sm font-semibold text-foreground">Current Interval</Text>
              <Tooltip content="5-minute real-time pricing intervals">
                <IconInfoCircle className="text-muted-foreground text-xs hover:text-accent transition-colors" />
              </Tooltip>
            </div>
            <div className="text-xl font-mono font-bold text-accent bg-accent/10 px-3 py-1 rounded-md border border-accent/20">
              {currentInterval}
            </div>
            <Text className="text-xs text-muted-foreground font-medium">
              Next in {countdownMinutes}:{String(countdownSeconds).padStart(2, "0")}
            </Text>
          </div>

          <div className="border-l border-border/40 pl-8 space-y-2">
            <div className="flex items-center gap-3">
              <Text className="text-sm font-semibold text-foreground">Latest LMP</Text>
              <Badge status={dataStatus.status} />
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-accent font-mono tracking-tight">
                ${latestLMP?.lmp.toFixed(2) || "--"}
              </span>
              {priceChange !== 0 && (
                <span className={`text-lg font-bold ${priceChangeColor} bg-current/10 px-2 py-1 rounded-md`}>
                  {priceChange > 0 ? "+" : ""}
                  {priceChange.toFixed(2)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Text className={`text-sm font-medium ${dataStatus.color}`}>{dataStatus.text}</Text>
              {dataAge > 0 && <Text className="text-sm text-muted-foreground">({dataAge.toFixed(1)}m ago)</Text>}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <Text className="text-xs text-muted-foreground font-medium">Node</Text>
            <Select
              value={selectedNode}
              onChange={onNodeChange}
              style={{ width: 140 }}
              size="default"
              placeholder="Select Node"
              className="font-mono"
            >
              <Option value="PJM-RTO">PJM-RTO</Option>
              <Option value="NYISO">NYISO</Option>
              <Option value="ISONE">ISO-NE</Option>
              <Option value="CAISO">CAISO</Option>
              <Option value="ERCOT">ERCOT</Option>
            </Select>
          </div>

          <div className="space-y-1">
            <Text className="text-xs text-muted-foreground font-medium">Date</Text>
            <DatePicker
              value={selectedDate}
              onChange={(date) => onDateChange(date || new Date())}
              size="default"
              style={{ width: 160 }}
              format="MM/DD/YYYY"
            />
          </div>

          <div className="flex gap-2 mt-6">
            <Tooltip content="Refresh data">
              <Button
                icon={<IconRefresh />}
                size="default"
                type="outline"
                className="hover:bg-accent/10 hover:border-accent/50 transition-all duration-200"
              />
            </Tooltip>

            <Tooltip content="Settings">
              <Button
                icon={<IconSettings />}
                size="default"
                type="outline"
                onClick={onSettingsClick}
                className="hover:bg-accent/10 hover:border-accent/50 transition-all duration-200"
              />
            </Tooltip>
          </div>
        </div>
      </div>
    </Card>
  )
}
