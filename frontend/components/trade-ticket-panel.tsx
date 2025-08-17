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

interface TradeTicketPanelProps {
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

export default function TradeTicketPanel({ currentTime, onTradeSubmit }: TradeTicketPanelProps) {
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
    disabled: false,
  }))

  // Mock DA LMP for selected hour
  const getDaLmpForHour = (hour: number) => {
    return 45 + Math.sin(((hour - 6) * Math.PI) / 12) * 12 + Math.random() * 4 - 2
  }

  const estimatedDaLmp = getDaLmpForHour(selectedHour)

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
    
    // Find next 5-minute mark
    const minutes = now.getMinutes()
    const nextFiveMin = Math.ceil(minutes / 5) * 5
    
    const nextModerationTime = new Date(now)
    
    if (nextFiveMin >= 60) {
      // Next hour
      nextModerationTime.setHours(nextModerationTime.getHours() + 1, 0, 45, 0)
    } else {
      // Same hour
      nextModerationTime.setMinutes(nextFiveMin, 45, 0)
    }
    
    return nextModerationTime
  }
  
  // Calculate delay in milliseconds
  const getModerationDelay = () => {
    const nextModerationTime = getNextModerationTime()
    return nextModerationTime.getTime() - currentTime.getTime()
  }

  // Auto-set hour for fake mode
  const fakeHour = getCurrentPlusOneHour()

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
        // Submit to fake order API with current hour + 1
        const hourStartUTC = getCurrentPlusOneHourUTC()
        const params = new URLSearchParams({
          side: side.toUpperCase(),
          qty_mwh: quantity.toString(),
          limit_price: limitPrice.toString(),
          hour_start_utc: hourStartUTC,
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
            const moderateResponse = await fetch(`/api/v1/orders/moderate/${encodeURIComponent(hourStartUTC)}`, {
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
                  content: `Order ${orderResult.status.toLowerCase()} ${orderResult.approval_rt_lmp ? `at ${orderResult.approval_rt_lmp}` : ''} ${orderResult.reject_reason ? `- ${orderResult.reject_reason}` : ''}`,
                  duration: 5000,
                })
              }
            }
          } catch (error) {
            console.error('Auto-moderation failed:', error)
          }
        }, moderationDelay) // Use calculated delay to next 5-min + 45s

      } else {
        // Original logic for non-fake mode
        newTicket.queuePosition = Math.floor(Math.random() * 50) + 1

        // Submit to parent component
        onTradeSubmit({
          hour: selectedHour,
          side,
          quantity,
          daLmp: estimatedDaLmp,
        })

        // Simulate auction results
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
    <Card>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Title level={5} className="mb-0">
            Day-Ahead Trade Ticket
          </Title>
          <div className="flex items-center gap-3">
            <Badge
              status={isTradingAllowed ? "success" : "error"}
              text={isTradingAllowed ? "Market Open" : "Market Closed"}
            />
          </div>
        </div>

        {/* Fake Mode Toggle */}
        <Card className={`${fakeMode ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {fakeMode ? (
                <IconFolder className="text-orange-600" />
              ) : (
                <IconBug className="text-gray-600" />
              )}
              <div>
                <Text className="text-sm font-medium">
                  {fakeMode ? "Fake Mode Active" : "Live Mode"}
                </Text>
                <Text className="text-xs text-gray-600 block">
                  {fakeMode 
                    ? `Orders auto-moderate at ${getNextModerationTime().toLocaleTimeString()} (next 5-min + 45s)` 
                    : "Standard simulation mode"
                  }
                </Text>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Text className="text-xs">Fake Mode</Text>
              <Switch
                checked={fakeMode}
                onChange={setFakeMode}
                size="small"
              />
            </div>
          </div>
        </Card>

        {/* Auction Countdown - only show in live mode */}
        {!fakeMode && (
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
        )}

        {/* Trading Form */}
        <div className="space-y-4">
          {/* Hour Selection */}
          <div>
            <Text className="text-sm font-medium mb-2 block">Delivery Hour</Text>
            {fakeMode ? (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Text className="text-sm font-medium text-orange-800">
                      Auto-selected: {String(fakeHour).padStart(2, "0")}:00 - {String(fakeHour + 1).padStart(2, "0")}:00
                    </Text>
                    <Text className="text-xs text-orange-600">
                      Fake mode uses current time + 1 hour
                    </Text>
                  </div>
                  <Text className="text-xs text-orange-500">
                    ~${getDaLmpForHour(fakeHour).toFixed(2)}
                  </Text>
                </div>
                <div className="pt-2 border-t border-orange-200">
                  <Text className="text-xs text-orange-700">
                    🕒 Moderation at: {getNextModerationTime().toLocaleTimeString()} 
                    <span className="text-orange-500">(next 5-min + 45s buffer)</span>
                  </Text>
                </div>
              </div>
            ) : (
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
            )}
          </div>

          {/* Side Selection */}
          <div>
            <Text className="text-sm font-medium mb-2 block">Side</Text>
            <RadioGroup value={side} onChange={setSide} disabled={!isTradingAllowed && !fakeMode}>
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
              disabled={!isTradingAllowed && !fakeMode}
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
              disabled={!isTradingAllowed && !fakeMode}
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
            disabled={(!isTradingAllowed && !fakeMode) || !isFormValid || isSubmitting}
            loading={isSubmitting}
            className="w-full"
          >
            {isSubmitting 
              ? "Submitting..." 
              : fakeMode 
                ? "Create Fake Order" 
                : isTradingAllowed 
                  ? "Submit DA Bid" 
                  : "Market Closed"
            }
          </Button>

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
              <Text className="text-sm font-medium mb-3 block">Recent Tickets</Text>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {tickets.slice(-3).map((ticket, index) => (
                  <Card key={index} className={ticket.isFake ? "bg-orange-50 border-orange-200" : "bg-gray-50"}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <Text className="text-sm font-medium">
                              {ticket.side} {ticket.quantity} MWh @ H{ticket.hour}
                            </Text>
                            {ticket.isFake && (
                              <Badge color="orange" text="FAKE" />
                            )}
                          </div>
                          <Text className="text-xs text-gray-500">Limit: ${ticket.limitPrice.toFixed(2)}</Text>
                          {ticket.orderId && (
                            <Text className="text-xs text-gray-400">ID: {ticket.orderId.substring(0, 8)}...</Text>
                          )}
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