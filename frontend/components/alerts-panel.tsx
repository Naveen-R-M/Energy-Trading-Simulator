"use client"

import { useState, useEffect } from "react"
import { Card, Typography, Alert, Badge, Button, Space } from "@arco-design/web-react"
import { IconNotification, IconClose } from "@arco-design/web-react/icon"

const { Title, Text } = Typography

interface AlertItem {
  id: string
  type: "price" | "spread" | "risk" | "system"
  severity: "info" | "warning" | "error"
  message: string
  timestamp: Date
  acknowledged: boolean
  value?: number
  threshold?: number
}

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])

  // Mock alert generation
  useEffect(() => {
    const generateMockAlert = () => {
      const alertTypes = ["price", "spread", "risk", "system"] as const
      const severities = ["info", "warning", "error"] as const
      const messages = {
        price: "LMP exceeded threshold",
        spread: "RT-DA spread alert triggered",
        risk: "Position limit approaching",
        system: "API latency increased",
      }

      const type = alertTypes[Math.floor(Math.random() * alertTypes.length)]
      const severity = severities[Math.floor(Math.random() * severities.length)]

      const newAlert: AlertItem = {
        id: Date.now().toString(),
        type,
        severity,
        message: messages[type],
        timestamp: new Date(),
        acknowledged: false,
        value: type === "price" ? 120 + Math.random() * 50 : undefined,
        threshold: type === "price" ? 100 : undefined,
      }

      setAlerts((prev) => [newAlert, ...prev.slice(0, 9)]) // Keep last 10 alerts
    }

    // Generate initial alerts
    generateMockAlert()

    // Generate random alerts
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        // 30% chance every 30 seconds
        generateMockAlert()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const acknowledgeAlert = (alertId: string) => {
    setAlerts((prev) => prev.map((alert) => (alert.id === alertId ? { ...alert, acknowledged: true } : alert)))
  }

  const dismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId))
  }

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case "error":
        return "red"
      case "warning":
        return "orange"
      case "info":
        return "blue"
      default:
        return "gray"
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "price":
      case "spread":
        return "💰"
      case "risk":
        return "⚠️"
      case "system":
        return "🔧"
      default:
        return "ℹ️"
    }
  }

  const unacknowledgedCount = alerts.filter((alert) => !alert.acknowledged).length

  if (alerts.length === 0) {
    return null
  }

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <IconNotification />
          <Title level={6} className="mb-0">
            Active Alerts
          </Title>
          {unacknowledgedCount > 0 && <Badge count={unacknowledgedCount} />}
        </div>
        <Button
          size="small"
          type="outline"
          onClick={() => setAlerts((prev) => prev.map((alert) => ({ ...alert, acknowledged: true })))}
        >
          Acknowledge All
        </Button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {alerts.map((alert) => (
          <Alert
            key={alert.id}
            type={alert.severity}
            message={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{getAlertIcon(alert.type)}</span>
                  <div>
                    <Text className="font-medium">{alert.message}</Text>
                    {alert.value && alert.threshold && (
                      <Text className="text-xs text-gray-500 block">
                        Value: ${alert.value.toFixed(2)} (Threshold: ${alert.threshold.toFixed(2)})
                      </Text>
                    )}
                    <Text className="text-xs text-gray-400">{alert.timestamp.toLocaleTimeString()}</Text>
                  </div>
                </div>
                <Space>
                  {!alert.acknowledged && (
                    <Button size="mini" type="outline" onClick={() => acknowledgeAlert(alert.id)}>
                      ACK
                    </Button>
                  )}
                  <Button size="mini" type="text" icon={<IconClose />} onClick={() => dismissAlert(alert.id)} />
                </Space>
              </div>
            }
            className={alert.acknowledged ? "opacity-60" : ""}
            showIcon={false}
          />
        ))}
      </div>
    </Card>
  )
}
