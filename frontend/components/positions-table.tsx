"use client"

import { useState } from "react"
import {
  Card,
  Typography,
  Table,
  Badge,
  Progress,
  Collapse,
  Space,
  Tooltip,
  Button,
  Tabs,
} from "@arco-design/web-react"
import { IconInfoCircle, IconEye, IconEyeInvisible, IconCaretRight, IconCaretDown } from "@arco-design/web-react/icon"
import type { TradePosition } from "@/app/page"

const { Title, Text } = Typography
const { Panel } = Collapse
const { TabPane } = Tabs

interface PositionsTableProps {
  positions: TradePosition[]
  currentTime: Date
}

interface RTSlice {
  interval: number
  time: string
  rtLmp: number
  filled: boolean
  slicePL: number
}

interface ClosedPosition {
  id: string
  date: string
  hour: number
  side: "Buy" | "Sell"
  quantity: number
  daLmp: number
  avgRtLmp: number
  finalPL: number
  settled: boolean
  reconciled: boolean
}

// Generate mock RT slices for a position
const generateRTSlices = (hour: number, side: "Buy" | "Sell", daLmp: number, quantity: number): RTSlice[] => {
  const slices: RTSlice[] = []
  const currentHour = new Date().getHours()
  const isCurrentHour = hour === currentHour
  const filledIntervals = isCurrentHour ? Math.floor(Math.random() * 12) + 1 : 12

  for (let i = 0; i < 12; i++) {
    const minute = i * 5
    const rtLmp = daLmp + Math.random() * 10 - 5
    const filled = i < filledIntervals
    const slicePL = filled ? (side === "Buy" ? daLmp - rtLmp : rtLmp - daLmp) * (quantity / 12) : 0

    slices.push({
      interval: i + 1,
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      rtLmp,
      filled,
      slicePL,
    })
  }

  return slices
}

// Generate mock closed positions
const generateClosedPositions = (): ClosedPosition[] => {
  const positions: ClosedPosition[] = []
  const today = new Date()

  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const date = new Date(today)
    date.setDate(date.getDate() - dayOffset)

    const numPositions = Math.floor(Math.random() * 5) + 1
    for (let i = 0; i < numPositions; i++) {
      const hour = Math.floor(Math.random() * 24)
      const side: "Buy" | "Sell" = Math.random() > 0.5 ? "Buy" : "Sell"
      const quantity = (Math.floor(Math.random() * 10) + 1) * 50
      const daLmp = 40 + Math.random() * 20
      const avgRtLmp = daLmp + Math.random() * 8 - 4
      const finalPL = (side === "Buy" ? daLmp - avgRtLmp : avgRtLmp - daLmp) * quantity

      positions.push({
        id: `${date.toISOString().split("T")[0]}-${hour}-${i}`,
        date: date.toLocaleDateString(),
        hour,
        side,
        quantity,
        daLmp,
        avgRtLmp,
        finalPL,
        settled: dayOffset > 2,
        reconciled: dayOffset > 5,
      })
    }
  }

  return positions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export default function PositionsTable({ positions, currentTime }: PositionsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [showProjectedPL, setShowProjectedPL] = useState(true)
  const [activeTab, setActiveTab] = useState("open")

  const closedPositions = generateClosedPositions()

  const toggleRowExpansion = (positionId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(positionId)) {
      newExpanded.delete(positionId)
    } else {
      newExpanded.add(positionId)
    }
    setExpandedRows(newExpanded)
  }

  const calculateLivePL = (
    position: TradePosition,
  ): { livePL: number; projectedPL: number; filledIntervals: number } => {
    const rtSlices = generateRTSlices(position.hour, position.side, position.daLmp, position.quantity)
    const filledSlices = rtSlices.filter((slice) => slice.filled)
    const livePL = filledSlices.reduce((sum, slice) => sum + slice.slicePL, 0)
    const projectedPL = rtSlices.reduce((sum, slice) => sum + slice.slicePL, 0)

    return {
      livePL,
      projectedPL,
      filledIntervals: filledSlices.length,
    }
  }

  const formatCurrency = (value: number) => {
    const color = value >= 0 ? "text-green-600" : "text-red-600"
    const sign = value >= 0 ? "+" : ""
    return (
      <span className={color}>
        {sign}${value.toFixed(2)}
      </span>
    )
  }

  const formatTime = (hour: number) => {
    const utcTime = `${String(hour).padStart(2, "0")}:00 UTC`
    const etHour = (hour - 5 + 24) % 24 // Rough ET conversion
    const etTime = `${String(etHour).padStart(2, "0")}:00 ET`
    return (
      <div>
        <div className="font-medium">{etTime}</div>
        <div className="text-xs text-gray-500">{utcTime}</div>
      </div>
    )
  }

  const openPositionsColumns = [
    {
      title: "",
      dataIndex: "expand",
      width: 40,
      render: (_: any, record: TradePosition) => (
        <Button
          type="text"
          size="mini"
          icon={expandedRows.has(record.id) ? <IconCaretDown /> : <IconCaretRight />}
          onClick={() => toggleRowExpansion(record.id)}
        />
      ),
    },
    {
      title: "Hour",
      dataIndex: "hour",
      render: (hour: number) => formatTime(hour),
    },
    {
      title: "DA LMP",
      dataIndex: "daLmp",
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: "Side",
      dataIndex: "side",
      render: (side: "Buy" | "Sell") => <Badge color={side === "Buy" ? "green" : "red"} text={side} />,
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      render: (value: number) => `${value} MWh`,
    },
    {
      title: "Progress",
      dataIndex: "progress",
      render: (_: any, record: TradePosition) => {
        const { filledIntervals } = calculateLivePL(record)
        const progress = (filledIntervals / 12) * 100
        return (
          <div className="w-24">
            <Progress percent={progress} size="small" showText={false} />
            <Text className="text-xs text-gray-500">{filledIntervals}/12</Text>
          </div>
        )
      },
    },
    {
      title: "Live P&L",
      dataIndex: "livePL",
      render: (_: any, record: TradePosition) => {
        const { livePL } = calculateLivePL(record)
        return formatCurrency(livePL)
      },
    },
    ...(showProjectedPL
      ? [
          {
            title: (
              <div className="flex items-center gap-1">
                <span>Projected P&L</span>
                <Tooltip content="Estimated P&L if all remaining intervals fill at current RT prices">
                  <IconInfoCircle className="text-gray-400 text-xs" />
                </Tooltip>
              </div>
            ),
            dataIndex: "projectedPL",
            render: (_: any, record: TradePosition) => {
              const { projectedPL } = calculateLivePL(record)
              return <span className="text-gray-600">${projectedPL.toFixed(2)}</span>
            },
          },
        ]
      : []),
  ]

  const closedPositionsColumns = [
    {
      title: "Date",
      dataIndex: "date",
    },
    {
      title: "Hour",
      dataIndex: "hour",
      render: (hour: number) => formatTime(hour),
    },
    {
      title: "Side",
      dataIndex: "side",
      render: (side: "Buy" | "Sell") => <Badge color={side === "Buy" ? "green" : "red"} text={side} />,
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      render: (value: number) => `${value} MWh`,
    },
    {
      title: "DA LMP",
      dataIndex: "daLmp",
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: "Avg RT LMP",
      dataIndex: "avgRtLmp",
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: "Final P&L",
      dataIndex: "finalPL",
      render: (value: number) => formatCurrency(value),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (_: any, record: ClosedPosition) => (
        <Space>
          <Badge color={record.settled ? "green" : "orange"} text={record.settled ? "Settled" : "Pending"} />
          {record.reconciled && <Badge color="blue" text="Reconciled" />}
        </Space>
      ),
    },
  ]

  const renderExpandedRow = (record: TradePosition) => {
    const rtSlices = generateRTSlices(record.hour, record.side, record.daLmp, record.quantity)

    const sliceColumns = [
      {
        title: "Interval",
        dataIndex: "interval",
        width: 80,
      },
      {
        title: "Time",
        dataIndex: "time",
        width: 80,
      },
      {
        title: "RT LMP",
        dataIndex: "rtLmp",
        render: (value: number) => `$${value.toFixed(2)}`,
        width: 100,
      },
      {
        title: "Status",
        dataIndex: "filled",
        render: (filled: boolean) => <Badge color={filled ? "green" : "gray"} text={filled ? "Filled" : "Pending"} />,
        width: 100,
      },
      {
        title: "Slice P&L",
        dataIndex: "slicePL",
        render: (value: number, record: RTSlice) =>
          record.filled ? formatCurrency(value) : <span className="text-gray-400">--</span>,
        width: 100,
      },
    ]

    return (
      <div className="p-4 bg-gray-50">
        <Title level={6} className="mb-3">
          5-Minute RT Slices - Hour {record.hour}
        </Title>
        <Table
          columns={sliceColumns}
          data={rtSlices}
          pagination={false}
          size="mini"
          className="mb-3"
          rowClassName={(record: RTSlice) => (record.filled ? "" : "opacity-50")}
        />
        <div className="flex justify-between text-sm text-gray-600">
          <span>Total Filled: {rtSlices.filter((s) => s.filled).length}/12 intervals</span>
          <span>
            Live P&L: {formatCurrency(rtSlices.filter((s) => s.filled).reduce((sum, s) => sum + s.slicePL, 0))}
          </span>
        </div>
      </div>
    )
  }

  const totalLivePL = positions.reduce((sum, pos) => sum + calculateLivePL(pos).livePL, 0)
  const totalProjectedPL = positions.reduce((sum, pos) => sum + calculateLivePL(pos).projectedPL, 0)

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <Title level={5} className="mb-0">
          Positions Management
        </Title>
        <Space>
          <Button
            type="text"
            size="small"
            icon={showProjectedPL ? <IconEye /> : <IconEyeInvisible />}
            onClick={() => setShowProjectedPL(!showProjectedPL)}
          >
            Projected P&L
          </Button>
        </Space>
      </div>

      <Tabs activeTab={activeTab} onChange={setActiveTab}>
        <TabPane key="open" title={`Open Positions (${positions.length})`}>
          {positions.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <Text className="font-medium">Portfolio Summary</Text>
                <Space size="large">
                  <div className="text-center">
                    <Text className="text-sm text-gray-600 block">Live P&L</Text>
                    <Text className="font-bold">{formatCurrency(totalLivePL)}</Text>
                  </div>
                  {showProjectedPL && (
                    <div className="text-center">
                      <Text className="text-sm text-gray-600 block">Projected P&L</Text>
                      <Text className="font-bold text-gray-600">${totalProjectedPL.toFixed(2)}</Text>
                    </div>
                  )}
                </Space>
              </div>
            </div>
          )}

          <Table
            columns={openPositionsColumns}
            data={positions}
            pagination={false}
            expandedRowRender={renderExpandedRow}
            expandedRowKeys={Array.from(expandedRows)}
            onExpand={(expanded, record) => {
              if (expanded) {
                setExpandedRows((prev) => new Set([...prev, record.id]))
              } else {
                setExpandedRows((prev) => {
                  const newSet = new Set(prev)
                  newSet.delete(record.id)
                  return newSet
                })
              }
            }}
            noDataElement={
              <div className="text-center py-8">
                <Text className="text-gray-500">No open positions</Text>
                <Text className="text-sm text-gray-400 block mt-1">Submit trades to see positions here</Text>
              </div>
            }
          />
        </TabPane>

        <TabPane key="closed" title={`Closed Positions (${closedPositions.length})`}>
          <Collapse className="mb-4">
            <Panel header="Position History" key="history">
              <Table
                columns={closedPositionsColumns}
                data={closedPositions}
                pagination={{ pageSize: 10 }}
                size="small"
              />

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <Text className="text-sm text-gray-600 block">Total Closed P&L</Text>
                    <Text className="font-bold">
                      {formatCurrency(closedPositions.reduce((sum, pos) => sum + pos.finalPL, 0))}
                    </Text>
                  </div>
                  <div>
                    <Text className="text-sm text-gray-600 block">Win Rate</Text>
                    <Text className="font-bold">
                      {(
                        (closedPositions.filter((pos) => pos.finalPL > 0).length / closedPositions.length) *
                        100
                      ).toFixed(1)}
                      %
                    </Text>
                  </div>
                  <div>
                    <Text className="text-sm text-gray-600 block">Avg Trade</Text>
                    <Text className="font-bold">
                      $
                      {(closedPositions.reduce((sum, pos) => sum + pos.finalPL, 0) / closedPositions.length).toFixed(2)}
                    </Text>
                  </div>
                  <div>
                    <Text className="text-sm text-gray-600 block">Settled</Text>
                    <Text className="font-bold">
                      {closedPositions.filter((pos) => pos.settled).length}/{closedPositions.length}
                    </Text>
                  </div>
                </div>
              </div>
            </Panel>
          </Collapse>
        </TabPane>
      </Tabs>
    </Card>
  )
}
