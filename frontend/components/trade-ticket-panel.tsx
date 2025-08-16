"use client"

import { useState } from "react"
import {
  Card,
  Typography,
  Button,
  Input,
  Select,
  Radio,
  Alert,
  Badge,
  Tooltip,
  Divider,
  Progress,
} from "@arco-design/web-react"
import {
  IconClockCircle,
  IconInfoCircle,
  IconCheckCircle,
  IconExclamationCircle,
  IconLoading,
} from "@arco-design/web-react/icon"
import type { TradePosition } from "@/app/page"

const { Title, Text } = Typography
const { Option } = Select
const { Group: RadioGroup } = Radio

interface TradeTicketPanelProps {
  currentTime: Date
  onTradeSubmit: (trade: Omit<TradePosition, "id" | "filledIntervals" | "livePL">) => void
}

type TradeStatus = "draft" | "queued" | "awarded" | "rejected" | "expired"

interface TradeTicket {
  hour: number
  side: "Buy" | "Sell"
  quantity: number
  limitPrice: number
  status: TradeStatus
  awardedPrice?: number
  queuePosition?: number
}

export default function TradeTicketPanel({ currentTime, onTradeSubmit }: TradeTicketPanelProps) {
  const [selectedHour, setSelectedHour] = useState<number>(currentTime.getHours())
  const [side, setSide] = useState<"Buy" | "Sell">("Buy")
  const [quantity, setQuantity] = useState<number>(100)
  const [limitPrice, setLimitPrice] = useState<number>(50.0)
  const [tickets, setTickets] = useState<TradeTicket[]>([])

  // Check if trading is allowed (before 11:00 AM ET)
  const etTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(currentTime)

  const etHour = Number.parseInt(etTime.split(":")[0])
  const etMinute = Number.parseInt(etTime.split(":")[1])
  const isTradingAllowed = etHour < 11 || (etHour === 10 && etMinute < 60)

  // Calculate time until DA auction close (11:00 AM ET)
  const getTimeToAuctionClose = () => {
    const etDate = new Date(currentTime.toLocaleString("en-US", { timeZone: "America/New_York" }))
    const auctionClose = new Date(etDate)
    auctionClose.setHours(11, 0, 0, 0)

    if (etDate > auctionClose) {
      // Next day's auction
      auctionClose.setDate(auctionClose.getDate() + 1)
    }

    const diff = auctionClose.getTime() - etDate.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    return { hours, minutes, seconds, totalSeconds: Math.floor(diff / 1000) }
  }

  const timeToClose = getTimeToAuctionClose()

  // Generate hour options
  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${String(i).padStart(2, "0")}:00 - ${String(i + 1).padStart(2, "0")}:00`,
    disabled: false, // In real app, would check if hour is already past
  }))

  // Mock DA LMP for selected hour
  const getDaLmpForHour = (hour: number) => {
    return 45 + Math.sin(((hour - 6) * Math.PI) / 12) * 12 + Math.random() * 4 - 2
  }

  const estimatedDaLmp = getDaLmpForHour(selectedHour)

  const handleSubmit = () => {
    if (!isTradingAllowed) return

    const newTicket: TradeTicket = {
      hour: selectedHour,
      side,
      quantity,
      limitPrice,
      status: "queued",
      queuePosition: Math.floor(Math.random() * 50) + 1,
    }

    setTickets((prev) => [...prev, newTicket])

    // Submit to parent component
    onTradeSubmit({
      hour: selectedHour,
      side,
      quantity,
      daLmp: estimatedDaLmp,
    })

    // Simulate auction results after a delay
    setTimeout(() => {
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket === newTicket
            ? {
                ...ticket,
                status: Math.random() > 0.3 ? "awarded" : "rejected",
                awardedPrice: Math.random() > 0.3 ? estimatedDaLmp + Math.random() * 2 - 1 : undefined,
              }
            : ticket,
        ),
      )
    }, 3000)
  }

  const getStatusIcon = (status: TradeStatus) => {
    switch (status) {
      case "queued":
        return <IconLoading className="text-blue-500" />
      case "awarded":
        return <IconCheckCircle className="text-green-500" />
      case "rejected":
        return <IconExclamationCircle className="text-red-500" />
      default:
        return <IconClockCircle className="text-gray-500" />
    }
  }

  const getStatusColor = (status: TradeStatus) => {
    switch (status) {
      case "queued":
        return "blue"
      case "awarded":
        return "green"
      case "rejected":
        return "red"
      default:
        return "gray"
    }
  }

  const isFormValid = quantity > 0 && limitPrice > 0 && selectedHour >= 0

  return (
    <Card>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Title level={5} className="mb-0">
            Day-Ahead Trade Ticket
          </Title>
          <Badge
            status={isTradingAllowed ? "success" : "error"}
            text={isTradingAllowed ? "Market Open" : "Market Closed"}
          />
        </div>

        {/* Auction Countdown */}
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconClockCircle className="text-blue-600" />
              <Text className="text-sm font-medium">DA Auction Close</Text>
            </div>
            <div className="text-right">
              <Text className="text-lg font-mono font-bold text-blue-700">
                {String(timeToClose.hours).padStart(2, "0")}:{String(timeToClose.minutes).padStart(2, "0")}:
                {String(timeToClose.seconds).padStart(2, "0")}
              </Text>
              <Text className="text-xs text-gray-600">until 11:00 AM ET</Text>
            </div>
          </div>
          <Progress
            percent={Math.max(0, 100 - (timeToClose.totalSeconds / (11 * 3600)) * 100)}
            size="small"
            className="mt-2"
            showText={false}
          />
        </Card>

        {/* Trading Form */}
        <div className="space-y-4">
          {/* Hour Selection */}
          <div>
            <Text className="text-sm font-medium mb-2 block">Delivery Hour</Text>
            <Select
              value={selectedHour}
              onChange={setSelectedHour}
              style={{ width: "100%" }}
              placeholder="Select hour"
              disabled={!isTradingAllowed}
            >
              {hourOptions.map((option) => (
                <Option key={option.value} value={option.value} disabled={option.disabled}>
                  <div className="flex justify-between">
                    <span>{option.label}</span>
                    <span className="text-gray-500 text-xs">~${getDaLmpForHour(option.value).toFixed(2)}</span>
                  </div>
                </Option>
              ))}
            </Select>
          </div>

          {/* Side Selection */}
          <div>
            <Text className="text-sm font-medium mb-2 block">Side</Text>
            <RadioGroup value={side} onChange={setSide} disabled={!isTradingAllowed}>
              <Radio value="Buy">
                <span className="text-green-600 font-medium">Buy</span>
                <Text className="text-xs text-gray-500 ml-2">Long position</Text>
              </Radio>
              <Radio value="Sell">
                <span className="text-red-600 font-medium">Sell</span>
                <Text className="text-xs text-gray-500 ml-2">Short position</Text>
              </Radio>
            </RadioGroup>
          </div>

          {/* Quantity */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Text className="text-sm font-medium">Quantity (MWh)</Text>
              <Tooltip content="Minimum 1 MWh, maximum 1000 MWh per hour">
                <IconInfoCircle className="text-gray-400 text-xs" />
              </Tooltip>
            </div>
            <Input
              type="number"
              value={quantity}
              onChange={(value) => setQuantity(Number(value))}
              placeholder="Enter quantity"
              suffix="MWh"
              min={1}
              max={1000}
              disabled={!isTradingAllowed}
            />
          </div>

          {/* Limit Price */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Text className="text-sm font-medium">Limit Price ($/MWh)</Text>
              <Tooltip content="Maximum price for buy orders, minimum price for sell orders">
                <IconInfoCircle className="text-gray-400 text-xs" />
              </Tooltip>
            </div>
            <Input
              type="number"
              value={limitPrice}
              onChange={(value) => setLimitPrice(Number(value))}
              placeholder="Enter limit price"
              prefix="$"
              step={0.01}
              disabled={!isTradingAllowed}
            />
            <Text className="text-xs text-gray-500 mt-1">
              Est. DA LMP: ${estimatedDaLmp.toFixed(2)} (
              {side === "Buy"
                ? limitPrice >= estimatedDaLmp
                  ? "Likely to clear"
                  : "May not clear"
                : limitPrice <= estimatedDaLmp
                  ? "Likely to clear"
                  : "May not clear"}
              )
            </Text>
          </div>

          {/* Submit Button */}
          <Button
            type="primary"
            size="large"
            onClick={handleSubmit}
            disabled={!isTradingAllowed || !isFormValid}
            className="w-full"
          >
            {isTradingAllowed ? "Submit DA Bid" : "Market Closed"}
          </Button>

          {!isTradingAllowed && (
            <Alert
              type="warning"
              message="Day-ahead market is closed"
              description="Bids must be submitted before 11:00 AM ET for next day delivery."
              showIcon
            />
          )}
        </div>

        {/* Active Tickets */}
        {tickets.length > 0 && (
          <>
            <Divider />
            <div>
              <Text className="text-sm font-medium mb-3 block">Recent Tickets</Text>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {tickets.slice(-3).map((ticket, index) => (
                  <Card key={index} className="bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.status)}
                        <div>
                          <Text className="text-sm font-medium">
                            {ticket.side} {ticket.quantity} MWh @ H{ticket.hour}
                          </Text>
                          <Text className="text-xs text-gray-500">Limit: ${ticket.limitPrice.toFixed(2)}</Text>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge color={getStatusColor(ticket.status)} text={ticket.status.toUpperCase()} />
                        {ticket.status === "queued" && ticket.queuePosition && (
                          <Text className="text-xs text-gray-500 block">Queue: #{ticket.queuePosition}</Text>
                        )}
                        {ticket.status === "awarded" && ticket.awardedPrice && (
                          <Text className="text-xs text-green-600 block">
                            Awarded: ${ticket.awardedPrice.toFixed(2)}
                          </Text>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
