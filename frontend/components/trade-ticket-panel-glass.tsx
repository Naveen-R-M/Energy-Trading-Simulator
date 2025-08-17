"use client"

import { useState } from "react"
import {
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

interface TradeTicketPanelGlassProps {
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

export default function TradeTicketPanelGlass({ currentTime, onTradeSubmit }: TradeTicketPanelGlassProps) {
  const [selectedHour, setSelectedHour] = useState<number>(currentTime.getHours())
  const [side, setSide] = useState<"Buy" | "Sell">("Buy")
  const [quantity, setQuantity] = useState<number>(100)
  const [limitPrice, setLimitPrice] = useState<number>(50.0)
  const [tickets, setTickets] = useState<TradeTicket[]>([])

  // Keep all your existing trading logic unchanged
  const etTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(currentTime)

  const etHour = Number.parseInt(etTime.split(":")[0])
  const etMinute = Number.parseInt(etTime.split(":")[1])
  const isTradingAllowed = etHour < 11 || (etHour === 10 && etMinute < 60)

  const getTimeToAuctionClose = () => {
    const etDate = new Date(currentTime.toLocaleString("en-US", { timeZone: "America/New_York" }))
    const auctionClose = new Date(etDate)
    auctionClose.setHours(11, 0, 0, 0)

    if (etDate > auctionClose) {
      auctionClose.setDate(auctionClose.getDate() + 1)
    }

    const diff = auctionClose.getTime() - etDate.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    return { hours, minutes, seconds, totalSeconds: Math.floor(diff / 1000) }
  }

  const timeToClose = getTimeToAuctionClose()

  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${String(i).padStart(2, "0")}:00 - ${String(i + 1).padStart(2, "0")}:00`,
    disabled: false,
  }))

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

    onTradeSubmit({
      hour: selectedHour,
      side,
      quantity,
      daLmp: estimatedDaLmp,
    })

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
        return <IconLoading className="text-blue-600" />
      case "awarded":
        return <IconCheckCircle className="text-green-600" />
      case "rejected":
        return <IconExclamationCircle className="text-red-600" />
      default:
        return <IconClockCircle className="text-slate-500" />
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
    <div 
      className="rounded-2xl p-6 border border-white/40 shadow-sm"
      style={{
        background: 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(12px)'
      }}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Day-Ahead Trade Ticket
          </h3>
          <Badge
            status={isTradingAllowed ? "success" : "error"}
            text={isTradingAllowed ? "Market Open" : "Market Closed"}
          />
        </div>

        {/* Auction Countdown - Glass Style */}
        <div 
          className="rounded-2xl p-4 border border-blue-200/50"
          style={{
            background: 'rgba(59, 130, 246, 0.08)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <IconClockCircle className="text-blue-600" />
              <span className="text-sm font-medium text-slate-700">DA Auction Close</span>
            </div>
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
              11:00 AM ET
            </span>
          </div>
          <div className="text-right">
            <div className="text-lg font-mono font-bold text-blue-600">
              {String(timeToClose.hours).padStart(2, "0")}:{String(timeToClose.minutes).padStart(2, "0")}:
              {String(timeToClose.seconds).padStart(2, "0")}
            </div>
            <div className="text-xs text-slate-500">until market close</div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-blue-100 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${Math.max(0, 100 - (timeToClose.totalSeconds / (11 * 3600)) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Trading Form */}
        <div className="space-y-4">
          {/* Hour Selection */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Delivery Hour</label>
            <div className="glass-select">
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
                      <span className="text-slate-500 text-xs">~${getDaLmpForHour(option.value).toFixed(2)}</span>
                    </div>
                  </Option>
                ))}
              </Select>
            </div>
          </div>

          {/* Side Selection - Glass Style */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Side</label>
            <div className="flex rounded-xl overflow-hidden border border-white/40">
              <button 
                onClick={() => setSide('Buy')}
                disabled={!isTradingAllowed}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-all ${
                  side === 'Buy' 
                    ? 'bg-green-500 text-white shadow-sm' 
                    : 'bg-white/50 text-slate-700 hover:bg-white/70'
                }`}
                style={side !== 'Buy' ? { backdropFilter: 'blur(8px)' } : {}}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="font-semibold">Buy</span>
                  <span className="text-xs opacity-80">Long position</span>
                </div>
              </button>
              <button 
                onClick={() => setSide('Sell')}
                disabled={!isTradingAllowed}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-all ${
                  side === 'Sell' 
                    ? 'bg-red-500 text-white shadow-sm' 
                    : 'bg-white/50 text-slate-700 hover:bg-white/70'
                }`}
                style={side !== 'Sell' ? { backdropFilter: 'blur(8px)' } : {}}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="font-semibold">Sell</span>
                  <span className="text-xs opacity-80">Short position</span>
                </div>
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium text-slate-700">Quantity (MWh)</label>
              <Tooltip content="Minimum 1 MWh, maximum 1000 MWh per hour">
                <IconInfoCircle className="text-slate-500 text-xs" />
              </Tooltip>
            </div>
            <div className="glass-input">
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
          </div>

          {/* Limit Price */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium text-slate-700">Limit Price ($/MWh)</label>
              <Tooltip content="Maximum price for buy orders, minimum price for sell orders">
                <IconInfoCircle className="text-slate-500 text-xs" />
              </Tooltip>
            </div>
            <div className="glass-input">
              <Input
                type="number"
                value={limitPrice}
                onChange={(value) => setLimitPrice(Number(value))}
                placeholder="Enter limit price"
                prefix="$"
                step={0.01}
                disabled={!isTradingAllowed}
              />
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Est. DA LMP: ${estimatedDaLmp.toFixed(2)} (
              {side === "Buy"
                ? limitPrice >= estimatedDaLmp
                  ? "Likely to clear"
                  : "May not clear"
                : limitPrice <= estimatedDaLmp
                ? "Likely to clear"
                : "May not clear"}
              )
            </div>
          </div>

          {/* Estimated Cost */}
          <div className="flex justify-between text-sm border-t border-white/30 pt-3">
            <span className="text-slate-600">Est. cost</span>
            <span className="font-medium text-slate-900">${(quantity * limitPrice).toFixed(2)}</span>
          </div>

          {/* Fill Probability - Glass Style */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700 font-medium">Fill probability</span>
              <span className="text-slate-900 font-medium">85%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all"
                style={{ width: '85%' }}
              ></div>
            </div>
            <div className="text-xs text-slate-500">
              Risk preview: PL = -5.00 ± 7.00
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!isTradingAllowed || !isFormValid}
            className={`w-full py-3 rounded-xl font-medium transition-all duration-200 ${
              isTradingAllowed && isFormValid
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isTradingAllowed ? "Submit DA Bid" : "Market Closed"}
          </button>

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
              <h4 className="text-sm font-medium mb-3 text-slate-900">Recent Tickets</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {tickets.slice(-3).map((ticket, index) => (
                  <div 
                    key={index}
                    className="rounded-xl p-3 border border-white/40"
                    style={{
                      background: 'rgba(255, 255, 255, 0.3)',
                      backdropFilter: 'blur(8px)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.status)}
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {ticket.side} {ticket.quantity} MWh @ H{ticket.hour}
                          </div>
                          <div className="text-xs text-slate-500">Limit: ${ticket.limitPrice.toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge color={getStatusColor(ticket.status)} text={ticket.status.toUpperCase()} />
                        {ticket.status === "queued" && ticket.queuePosition && (
                          <div className="text-xs text-slate-500 mt-1">Queue: #{ticket.queuePosition}</div>
                        )}
                        {ticket.status === "awarded" && ticket.awardedPrice && (
                          <div className="text-xs text-green-600 mt-1 font-medium">
                            Awarded: ${ticket.awardedPrice.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
