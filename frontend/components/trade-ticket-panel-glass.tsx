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
  Switch,
  Message,
} from "@arco-design/web-react"
import {
  IconClockCircle,
  IconInfoCircle,
  IconCheckCircle,
  IconExclamationCircle,
  IconLoading,
  IconFolder,
  IconBug,
} from "@arco-design/web-react/icon"
import type { TradePosition } from "@/app/page"

const { Title, Text } = Typography
const { Option } = Select
const { Group: RadioGroup } = Radio

interface TradeTicketPanelGlassProps {
  currentTime: Date
  onTradeSubmit: (trade: Omit<TradePosition, "id" | "filledIntervals" | "livePL">) => void
}

type TradeStatus = "draft" | "queued" | "awarded" | "rejected" | "expired" | "pending"

interface TradeTicket {
  hour: number
  side: "Buy" | "Sell"
  quantity: number
  limitPrice: number
  status: TradeStatus
  awardedPrice?: number
  queuePosition?: number
  orderId?: string
  isFake?: boolean
}

export default function TradeTicketPanelGlass({ currentTime, onTradeSubmit }: TradeTicketPanelGlassProps) {
  const [selectedHour, setSelectedHour] = useState<number>(currentTime.getHours())
  const [side, setSide] = useState<"Buy" | "Sell">("Buy")
  const [quantity, setQuantity] = useState<number>(100)
  const [limitPrice, setLimitPrice] = useState<number>(50.0)
  const [tickets, setTickets] = useState<TradeTicket[]>([])
  const [fakeMode, setFakeMode] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

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

  // Calculate time until DA auction close
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

  // Convert current hour + 1 to UTC ISO string for fake mode
  const getCurrentPlusOneHourUTC = () => {
    const nextHour = new Date(currentTime)
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
    return nextHour.toISOString()
  }

  // Get current hour + 1 for display
  const getCurrentPlusOneHour = () => {
    const nextHour = new Date(currentTime)
    nextHour.setHours(nextHour.getHours() + 1)
    return nextHour.getHours()
  }

  // Calculate next 5-minute interval + 45 seconds for moderation
  const getNextModerationTime = () => {
    const now = new Date(currentTime)
    const minutes = now.getMinutes()
    const nextFiveMin = Math.ceil(minutes / 5) * 5
    
    const nextModerationTime = new Date(now)
    
    if (nextFiveMin >= 60) {
      nextModerationTime.setHours(nextModerationTime.getHours() + 1, 0, 45, 0)
    } else {
      nextModerationTime.setMinutes(nextFiveMin, 45, 0)
    }
    
    return nextModerationTime
  }
  
  const getModerationDelay = () => {
    const nextModerationTime = getNextModerationTime()
    return nextModerationTime.getTime() - currentTime.getTime()
  }

  const fakeHour = getCurrentPlusOneHour()

  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${String(i).padStart(2, "0")}:00 - ${String(i + 1).padStart(2, "0")}:00`,
    disabled: false,
  }))

  const getDaLmpForHour = (hour: number) => {
    return 45 + Math.sin(((hour - 6) * Math.PI) / 12) * 12 + Math.random() * 4 - 2
  }

  const estimatedDaLmp = getDaLmpForHour(fakeMode ? fakeHour : selectedHour)

  const handleSubmit = async () => {
    if (!isTradingAllowed && !fakeMode) return
    if (isSubmitting) return

    setIsSubmitting(true)

    try {
      const effectiveHour = fakeMode ? fakeHour : selectedHour
      
      let newTicket: TradeTicket = {
        hour: effectiveHour,
        side,
        quantity,
        limitPrice,
        status: fakeMode ? "pending" : "queued",
        queuePosition: fakeMode ? undefined : Math.floor(Math.random() * 50) + 1,
        isFake: fakeMode,
      }

      if (fakeMode) {
        // Submit to fake order API with moderation time as hour_start_utc
        const moderationTimeUTC = getNextModerationTime().toISOString()
        const params = new URLSearchParams({
          side: side.toUpperCase(),
          qty_mwh: quantity.toString(),
          limit_price: limitPrice.toString(),
          hour_start_utc: moderationTimeUTC,  // Use moderation time for immediate processing
          location: "PJM-RTO",
          location_type: "ZONE"
        })

        const response = await fetch(`/api/v1/orders/fake?${params}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail || 'Failed to create fake order')
        }

        const result = await response.json()
        newTicket.orderId = result.order_id
        newTicket.status = "pending"

        const moderationDelay = getModerationDelay()
        const nextModerationTime = getNextModerationTime()
        
        Message.success({
          content: `Fake order created for hour ${effectiveHour}:00! Order ID: ${result.order_id.substring(0, 8)}... (Pending until ${nextModerationTime.toLocaleTimeString()})`,
          duration: 4000,
        })

        // Auto-trigger moderation at next 5-min interval + 45s
        setTimeout(async () => {
          try {
            const moderateResponse = await fetch(`/api/v1/orders/moderate/${encodeURIComponent(moderationTimeUTC)}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            })

            if (moderateResponse.ok) {
              const moderateResult = await moderateResponse.json()
              const orderResult = moderateResult.result.orders.find((o: any) => o.order_id === result.order_id)
              
              if (orderResult) {
                setTickets((prev) =>
                  prev.map((ticket) =>
                    ticket.orderId === result.order_id
                      ? {
                          ...ticket,
                          status: orderResult.status.toLowerCase() === 'approved' ? "awarded" : "rejected",
                          awardedPrice: orderResult.approval_rt_lmp || undefined,
                        }
                      : ticket,
                  ),
                )
                
                Message.info({
                  content: `Order ${orderResult.status.toLowerCase()} ${orderResult.approval_rt_lmp ? `at $${orderResult.approval_rt_lmp}` : ''} ${orderResult.reject_reason ? `- ${orderResult.reject_reason}` : ''}`,
                  duration: 5000,
                })
              }
            }
          } catch (error) {
            console.error('Auto-moderation failed:', error)
          }
        }, moderationDelay)

      } else {
        // Original logic for non-fake mode
        newTicket.queuePosition = Math.floor(Math.random() * 50) + 1

        onTradeSubmit({
          hour: effectiveHour,
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

      setTickets((prev) => [...prev, newTicket])

    } catch (error) {
      console.error('Error submitting order:', error)
      Message.error({
        content: `Failed to submit order: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 5000,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusIcon = (status: TradeStatus) => {
    switch (status) {
      case "queued":
      case "pending":
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
      case "pending":
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

        {/* Fake Mode Toggle - Enhanced Visual Effects */}
        <button 
          onClick={() => setFakeMode(!fakeMode)}
          className={`w-full rounded-2xl p-4 border-2 transition-all duration-300 cursor-pointer transform ${
            fakeMode 
              ? 'border-orange-400/60 bg-gradient-to-r from-orange-50/80 to-orange-100/60 shadow-orange-200/50 shadow-lg hover:shadow-orange-300/60 hover:scale-[1.02] hover:border-orange-500/70' 
              : 'border-slate-300/40 bg-white/40 hover:bg-gradient-to-r hover:from-blue-50/40 hover:to-slate-50/60 hover:border-blue-300/50 hover:shadow-blue-200/30 hover:shadow-md hover:scale-[1.01]'
          }`}
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {fakeMode ? (
                <div className="p-2 rounded-full bg-orange-500 text-white">
                  <IconFolder className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-slate-400 text-slate-500">
                  <IconBug className="w-4 h-4" />
                </div>
              )}
              <div>
                <div className={`text-sm font-semibold ${
                  fakeMode ? 'text-orange-800' : 'text-slate-700'
                }`}>
                  {fakeMode ? "🧪 FAKE MODE ACTIVE" : "📊 Live Simulation"}
                </div>
                <div className={`text-xs ${
                  fakeMode ? 'text-orange-600' : 'text-slate-500'
                }`}>
                  {fakeMode 
                    ? `Auto-moderate at ${getNextModerationTime().toLocaleTimeString()} • Stores in database` 
                    : "Standard simulation • No database storage"
                  }
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-slate-500">Toggle Mode</div>
                <div className={`text-xs font-medium ${
                  fakeMode ? 'text-orange-600' : 'text-slate-600'
                }`}>
                  {fakeMode ? 'FAKE' : 'LIVE'}
                </div>
              </div>
              <Switch
                checked={fakeMode}
                onChange={setFakeMode}
                size="default"
                className={fakeMode ? 'switch-orange' : ''}
              />
            </div>
          </div>
        </button>

        {/* Auction Countdown - Enhanced Clickable Effects */}
        {!fakeMode && (
          <button
            onClick={() => setFakeMode(false)}
            className="w-full rounded-2xl p-4 border border-blue-200/50 hover:border-blue-400/60 hover:scale-[1.01] hover:shadow-blue-200/40 hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-blue-100/20"
            style={{
              background: 'rgba(59, 130, 246, 0.08)',
              backdropFilter: 'blur(8px)'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="text-blue-500">
                  <IconClockCircle className="text-blue-600" />
                </div>
                <span className="text-sm font-medium text-blue-700">DA Auction Close</span>
                <span className="text-xs text-blue-500 opacity-60 ml-2">(Click Live Mode)</span>
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
          </button>
        )}

        {/* Trading Form */}
        <div className="space-y-4">
          {/* Hour Selection */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Delivery Hour</label>
            {fakeMode ? (
              <div 
                className="p-4 rounded-2xl border-2 border-orange-400/50 bg-gradient-to-r from-orange-100/60 to-orange-50/40"
                style={{ backdropFilter: 'blur(8px)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-base font-bold text-orange-800">
                      🕰️ {String(fakeHour).padStart(2, "0")}:00 - {String(fakeHour + 1).padStart(2, "0")}:00
                    </div>
                    <div className="text-xs text-orange-600 font-medium">
                      ⚙️ Auto-selected: Current time + 1 hour
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-orange-500">Est. Price</div>
                    <div className="text-sm font-bold text-orange-700">
                      ~${getDaLmpForHour(fakeHour).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-orange-300/50">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                    <div className="text-xs text-orange-700 font-medium">
                      🕒 Auto-moderation: {getNextModerationTime().toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-xs text-orange-600 ml-4">
                    (Next 5-minute interval + 45s safety buffer)
                  </div>
                </div>
              </div>
            ) : (
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
            )}
          </div>

          {/* Side Selection - Minimalistic with De-emphasized Unselected Side */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Side</label>
            <div className="flex rounded-xl overflow-hidden border border-white/40 bg-white/10">
              <button
                onClick={() => setSide('Buy')}
                disabled={!isTradingAllowed && !fakeMode}
                className={`flex-1 py-4 px-4 text-sm font-medium transition-all duration-200 border rounded-l-xl focus:outline-none focus:ring-2 focus:ring-green-400 ${
                  side === 'Buy'
                    ? 'border-green-600 text-green-700 bg-green-100 shadow-sm'
                    : 'border-green-400 text-green-600 bg-transparent hover:bg-green-50 hover:text-green-700 opacity-60 filter grayscale'
                }`}
                onMouseDown={e => e.currentTarget.classList.add('active-scale')}
                onMouseUp={e => e.currentTarget.classList.remove('active-scale')}
                onMouseLeave={e => e.currentTarget.classList.remove('active-scale')}
                aria-pressed={side === 'Buy'}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="font-bold text-base">🟢 Buy</span>
                  <span className={`text-xs ${side === 'Buy' ? 'text-green-700' : 'text-green-500'}`}>
                    Long position
                  </span>
                </div>
              </button>
              <button
                onClick={() => setSide('Sell')}
                disabled={!isTradingAllowed && !fakeMode}
                className={`flex-1 py-4 px-4 text-sm font-medium transition-all duration-200 border rounded-r-xl focus:outline-none focus:ring-2 focus:ring-red-400 ${
                  side === 'Sell'
                    ? 'border-red-600 text-red-700 bg-red-100 shadow-sm'
                    : 'border-red-400 text-red-600 bg-transparent hover:bg-red-50 hover:text-red-700 opacity-60 filter grayscale'
                }`}
                onMouseDown={e => e.currentTarget.classList.add('active-scale')}
                onMouseUp={e => e.currentTarget.classList.remove('active-scale')}
                onMouseLeave={e => e.currentTarget.classList.remove('active-scale')}
                aria-pressed={side === 'Sell'}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="font-bold text-base">🔴 Sell</span>
                  <span className={`text-xs ${side === 'Sell' ? 'text-red-700' : 'text-red-500'}`}>
                    Short position
                  </span>
                </div>
              </button>
            </div>

            {/* Minimal scale effect on press */}
            <style jsx>{`
              .active-scale {
                transform: scale(0.97);
                transition: transform 0.1s ease;
              }
            `}</style>
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
                disabled={!isTradingAllowed && !fakeMode}
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
                disabled={!isTradingAllowed && !fakeMode}
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

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={(!isTradingAllowed && !fakeMode) || !isFormValid || isSubmitting}
            className={`w-full py-4 rounded-xl font-bold text-base transition-all duration-200 ${
              (isTradingAllowed || fakeMode) && isFormValid && !isSubmitting
                ? fakeMode
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting 
              ? "🔄 Submitting..." 
              : fakeMode 
                ? "🧪 Create Fake Order" 
                : isTradingAllowed 
                  ? "Submit DA Order" 
                  : "Market Closed"
            }
          </button>

          {!isTradingAllowed && !fakeMode && (
            <Alert
              type="warning"
              message="Day-ahead market is closed"
              description="Bids must be submitted before 11:00 AM ET for next day delivery. Enable Fake Mode to place orders anyway."
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
                    className={`rounded-xl p-3 border ${ticket.isFake ? 'border-orange-200/50 bg-orange-50/30' : 'border-white/40 bg-white/30'}`}
                    style={{ backdropFilter: 'blur(8px)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-slate-900">
                              {ticket.side} {ticket.quantity} MWh @ H{ticket.hour}
                            </div>
                            {ticket.isFake && (
                              <Badge color="orange" text="FAKE" />
                            )}
                          </div>
                          <div className="text-xs text-slate-500">Limit: ${ticket.limitPrice.toFixed(2)}</div>
                          {ticket.orderId && (
                            <div className="text-xs text-slate-400">ID: {ticket.orderId.substring(0, 8)}...</div>
                          )}
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