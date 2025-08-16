"use client"

import { useState } from "react"
import {
  Drawer,
  Typography,
  Card,
  Switch,
  Input,
  Select,
  Slider,
  Button,
  Alert,
  Progress,
  Badge,
  Space,
  Tooltip,
  Tabs,
} from "@arco-design/web-react"
import {
  IconSettings,
  IconNotification,
  IconLock,
  IconPalette,
  IconWifi,
  IconInfoCircle,
  IconRefresh,
} from "@arco-design/web-react/icon"

const { Title, Text } = Typography
const { Option } = Select
const { TabPane } = Tabs

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  selectedNode: string
  onNodeChange: (node: string) => void
}

interface RiskLimits {
  maxOpenHours: number
  maxNetMWh: number
  maxDrawdown: number
  enablePriceAlerts: boolean
  priceAlertThreshold: number
  enableSpreadAlerts: boolean
  spreadAlertThreshold: number
}

interface AppSettings {
  theme: "light" | "dark" | "auto"
  timezone: string
  apiLatencyBuffer: number
  refreshInterval: number
  enableNotifications: boolean
  enableSounds: boolean
}

interface APIHealth {
  status: "healthy" | "degraded" | "down"
  latency: number
  rateLimit: {
    used: number
    limit: number
    resetTime: string
  }
  lastUpdate: string
}

export default function SettingsPanel({ isOpen, onClose, selectedNode, onNodeChange }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState("general")

  // Risk Controls State
  const [riskLimits, setRiskLimits] = useState<RiskLimits>({
    maxOpenHours: 10,
    maxNetMWh: 1000,
    maxDrawdown: 5000,
    enablePriceAlerts: true,
    priceAlertThreshold: 100,
    enableSpreadAlerts: false,
    spreadAlertThreshold: 10,
  })

  // App Settings State
  const [appSettings, setAppSettings] = useState<AppSettings>({
    theme: "light",
    timezone: "America/New_York",
    apiLatencyBuffer: 2000,
    refreshInterval: 5,
    enableNotifications: true,
    enableSounds: false,
  })

  // Mock API Health Data
  const [apiHealth] = useState<APIHealth>({
    status: "healthy",
    latency: 145,
    rateLimit: {
      used: 847,
      limit: 1000,
      resetTime: "14:32:15",
    },
    lastUpdate: new Date().toLocaleTimeString(),
  })

  const updateRiskLimit = <K extends keyof RiskLimits>(key: K, value: RiskLimits[K]) => {
    setRiskLimits((prev) => ({ ...prev, [key]: value }))
  }

  const updateAppSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setAppSettings((prev) => ({ ...prev, [key]: value }))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "green"
      case "degraded":
        return "orange"
      case "down":
        return "red"
      default:
        return "gray"
    }
  }

  const resetToDefaults = () => {
    setRiskLimits({
      maxOpenHours: 10,
      maxNetMWh: 1000,
      maxDrawdown: 5000,
      enablePriceAlerts: true,
      priceAlertThreshold: 100,
      enableSpreadAlerts: false,
      spreadAlertThreshold: 10,
    })
    setAppSettings({
      theme: "light",
      timezone: "America/New_York",
      apiLatencyBuffer: 2000,
      refreshInterval: 5,
      enableNotifications: true,
      enableSounds: false,
    })
  }

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <IconSettings />
          <span>Settings & Risk Controls</span>
        </div>
      }
      visible={isOpen}
      onCancel={onClose}
      width={480}
      footer={
        <div className="flex justify-between">
          <Button onClick={resetToDefaults} type="outline">
            Reset to Defaults
          </Button>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" onClick={onClose}>
              Save Changes
            </Button>
          </Space>
        </div>
      }
    >
      <Tabs activeTab={activeTab} onChange={setActiveTab} className="h-full">
        {/* General Settings */}
        <TabPane
          key="general"
          title={
            <div className="flex items-center gap-2">
              <IconSettings className="text-sm" />
              <span>General</span>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Market Settings */}
            <Card>
              <Title level={6} className="mb-4">
                Market Settings
              </Title>
              <div className="space-y-4">
                <div>
                  <Text className="text-sm font-medium mb-2 block">Default Node</Text>
                  <Select value={selectedNode} onChange={onNodeChange} style={{ width: "100%" }}>
                    <Option value="PJM-RTO">PJM-RTO</Option>
                    <Option value="NYISO">NYISO</Option>
                    <Option value="ISONE">ISO-NE</Option>
                    <Option value="CAISO">CAISO</Option>
                    <Option value="ERCOT">ERCOT</Option>
                    <Option value="MISO">MISO</Option>
                  </Select>
                </div>

                <div>
                  <Text className="text-sm font-medium mb-2 block">Timezone</Text>
                  <Select
                    value={appSettings.timezone}
                    onChange={(value) => updateAppSetting("timezone", value)}
                    style={{ width: "100%" }}
                  >
                    <Option value="America/New_York">Eastern Time</Option>
                    <Option value="America/Chicago">Central Time</Option>
                    <Option value="America/Denver">Mountain Time</Option>
                    <Option value="America/Los_Angeles">Pacific Time</Option>
                    <Option value="UTC">UTC</Option>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Text className="text-sm font-medium">Data Refresh Interval</Text>
                    <Tooltip content="How often to poll for new market data">
                      <IconInfoCircle className="text-gray-400 text-xs" />
                    </Tooltip>
                  </div>
                  <Select
                    value={appSettings.refreshInterval}
                    onChange={(value) => updateAppSetting("refreshInterval", value)}
                    style={{ width: "100%" }}
                  >
                    <Option value={1}>1 minute</Option>
                    <Option value={5}>5 minutes</Option>
                    <Option value={10}>10 minutes</Option>
                    <Option value={15}>15 minutes</Option>
                  </Select>
                </div>
              </div>
            </Card>

            {/* UI Preferences */}
            <Card>
              <Title level={6} className="mb-4">
                <div className="flex items-center gap-2">
                  <IconPalette />
                  UI Preferences
                </div>
              </Title>
              <div className="space-y-4">
                <div>
                  <Text className="text-sm font-medium mb-2 block">Theme</Text>
                  <Select
                    value={appSettings.theme}
                    onChange={(value) => updateAppSetting("theme", value)}
                    style={{ width: "100%" }}
                  >
                    <Option value="light">Light</Option>
                    <Option value="dark">Dark</Option>
                    <Option value="auto">Auto (System)</Option>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-sm font-medium">Enable Notifications</Text>
                    <Text className="text-xs text-gray-500 block">Browser notifications for alerts</Text>
                  </div>
                  <Switch
                    checked={appSettings.enableNotifications}
                    onChange={(checked) => updateAppSetting("enableNotifications", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-sm font-medium">Sound Alerts</Text>
                    <Text className="text-xs text-gray-500 block">Audio notifications for price alerts</Text>
                  </div>
                  <Switch
                    checked={appSettings.enableSounds}
                    onChange={(checked) => updateAppSetting("enableSounds", checked)}
                  />
                </div>
              </div>
            </Card>

            {/* API Settings */}
            <Card>
              <Title level={6} className="mb-4">
                <div className="flex items-center gap-2">
                  <IconWifi />
                  API Configuration
                </div>
              </Title>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Text className="text-sm font-medium">Latency Buffer (ms)</Text>
                    <Tooltip content="Additional delay to account for network latency">
                      <IconInfoCircle className="text-gray-400 text-xs" />
                    </Tooltip>
                  </div>
                  <Slider
                    value={appSettings.apiLatencyBuffer}
                    onChange={(value) => updateAppSetting("apiLatencyBuffer", value)}
                    min={500}
                    max={5000}
                    step={100}
                    showTicks
                    marks={{
                      500: "0.5s",
                      2000: "2s",
                      5000: "5s",
                    }}
                  />
                  <Text className="text-xs text-gray-500 mt-1">Current: {appSettings.apiLatencyBuffer}ms</Text>
                </div>
              </div>
            </Card>
          </div>
        </TabPane>

        {/* Risk Controls */}
        <TabPane
          key="risk"
          title={
            <div className="flex items-center gap-2">
              <IconLock className="text-sm" />
              <span>Risk Controls</span>
            </div>
          }
        >
          <div className="space-y-6">
            <Alert
              type="info"
              message="Risk Management"
              description="These controls help prevent excessive losses and manage position exposure."
              showIcon
            />

            {/* Position Limits */}
            <Card>
              <Title level={6} className="mb-4">
                Position Limits
              </Title>
              <div className="space-y-4">
                <div>
                  <Text className="text-sm font-medium mb-2 block">Max Open Hours</Text>
                  <Input
                    type="number"
                    value={riskLimits.maxOpenHours}
                    onChange={(value) => updateRiskLimit("maxOpenHours", Number(value))}
                    suffix="hours"
                    min={1}
                    max={24}
                  />
                  <Text className="text-xs text-gray-500 mt-1">Maximum number of hours with open positions</Text>
                </div>

                <div>
                  <Text className="text-sm font-medium mb-2 block">Max Net Position</Text>
                  <Input
                    type="number"
                    value={riskLimits.maxNetMWh}
                    onChange={(value) => updateRiskLimit("maxNetMWh", Number(value))}
                    suffix="MWh"
                    min={100}
                    max={10000}
                    step={100}
                  />
                  <Text className="text-xs text-gray-500 mt-1">Maximum net long or short position</Text>
                </div>

                <div>
                  <Text className="text-sm font-medium mb-2 block">Max Drawdown</Text>
                  <Input
                    type="number"
                    value={riskLimits.maxDrawdown}
                    onChange={(value) => updateRiskLimit("maxDrawdown", Number(value))}
                    prefix="$"
                    min={1000}
                    max={50000}
                    step={500}
                  />
                  <Text className="text-xs text-gray-500 mt-1">Stop trading if losses exceed this amount</Text>
                </div>
              </div>
            </Card>

            {/* Price Alerts */}
            <Card>
              <Title level={6} className="mb-4">
                <div className="flex items-center gap-2">
                  <IconNotification />
                  Price Alerts
                </div>
              </Title>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-sm font-medium">Price Alerts</Text>
                    <Text className="text-xs text-gray-500 block">Alert when LMP exceeds threshold</Text>
                  </div>
                  <Switch
                    checked={riskLimits.enablePriceAlerts}
                    onChange={(checked) => updateRiskLimit("enablePriceAlerts", checked)}
                  />
                </div>

                {riskLimits.enablePriceAlerts && (
                  <div>
                    <Text className="text-sm font-medium mb-2 block">Price Threshold</Text>
                    <Input
                      type="number"
                      value={riskLimits.priceAlertThreshold}
                      onChange={(value) => updateRiskLimit("priceAlertThreshold", Number(value))}
                      prefix="$"
                      suffix="/MWh"
                      min={0}
                      step={5}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-sm font-medium">Spread Alerts</Text>
                    <Text className="text-xs text-gray-500 block">Alert on RT vs DA spread</Text>
                  </div>
                  <Switch
                    checked={riskLimits.enableSpreadAlerts}
                    onChange={(checked) => updateRiskLimit("enableSpreadAlerts", checked)}
                  />
                </div>

                {riskLimits.enableSpreadAlerts && (
                  <div>
                    <Text className="text-sm font-medium mb-2 block">Spread Threshold</Text>
                    <Input
                      type="number"
                      value={riskLimits.spreadAlertThreshold}
                      onChange={(value) => updateRiskLimit("spreadAlertThreshold", Number(value))}
                      prefix="$"
                      suffix="/MWh"
                      min={0}
                      step={1}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Current Risk Status */}
            <Card className="bg-blue-50">
              <Title level={6} className="mb-4">
                Current Risk Status
              </Title>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Text className="text-sm">Open Hours</Text>
                  <div className="flex items-center gap-2">
                    <Text className="text-sm font-medium">3 / {riskLimits.maxOpenHours}</Text>
                    <Progress
                      percent={(3 / riskLimits.maxOpenHours) * 100}
                      size="small"
                      showText={false}
                      className="w-16"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <Text className="text-sm">Net Position</Text>
                  <div className="flex items-center gap-2">
                    <Text className="text-sm font-medium">450 / {riskLimits.maxNetMWh} MWh</Text>
                    <Progress
                      percent={(450 / riskLimits.maxNetMWh) * 100}
                      size="small"
                      showText={false}
                      className="w-16"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <Text className="text-sm">Current P&L</Text>
                  <Text className="text-sm font-medium text-green-600">+$1,247.50</Text>
                </div>
              </div>
            </Card>
          </div>
        </TabPane>

        {/* API Health */}
        <TabPane
          key="api"
          title={
            <div className="flex items-center gap-2">
              <IconWifi className="text-sm" />
              <span>API Health</span>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Connection Status */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <Title level={6} className="mb-0">
                  Connection Status
                </Title>
                <Button icon={<IconRefresh />} size="small" type="outline">
                  Refresh
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Text className="text-sm">GridStatus API</Text>
                  <Badge color={getStatusColor(apiHealth.status)} text={apiHealth.status.toUpperCase()} />
                </div>

                <div className="flex items-center justify-between">
                  <Text className="text-sm">Latency</Text>
                  <Text className="text-sm font-medium">{apiHealth.latency}ms</Text>
                </div>

                <div className="flex items-center justify-between">
                  <Text className="text-sm">Last Update</Text>
                  <Text className="text-sm font-medium">{apiHealth.lastUpdate}</Text>
                </div>
              </div>
            </Card>

            {/* Rate Limits */}
            <Card>
              <Title level={6} className="mb-4">
                Rate Limits
              </Title>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Text className="text-sm">API Calls</Text>
                    <Text className="text-sm font-medium">
                      {apiHealth.rateLimit.used} / {apiHealth.rateLimit.limit}
                    </Text>
                  </div>
                  <Progress
                    percent={(apiHealth.rateLimit.used / apiHealth.rateLimit.limit) * 100}
                    size="small"
                    color={apiHealth.rateLimit.used / apiHealth.rateLimit.limit > 0.8 ? "#f5222d" : "#1890ff"}
                  />
                  <Text className="text-xs text-gray-500 mt-1">Resets at {apiHealth.rateLimit.resetTime}</Text>
                </div>

                {apiHealth.rateLimit.used / apiHealth.rateLimit.limit > 0.8 && (
                  <Alert
                    type="warning"
                    message="Rate limit warning"
                    description="You're approaching your API rate limit. Consider reducing refresh frequency."
                    showIcon
                    size="small"
                  />
                )}
              </div>
            </Card>

            {/* Endpoint Status */}
            <Card>
              <Title level={6} className="mb-4">
                Endpoint Status
              </Title>
              <div className="space-y-3">
                {[
                  { name: "Real-Time LMP", status: "healthy", latency: 120 },
                  { name: "Day-Ahead Prices", status: "healthy", latency: 95 },
                  { name: "Load Forecast", status: "degraded", latency: 340 },
                  { name: "Fuel Mix", status: "healthy", latency: 180 },
                ].map((endpoint) => (
                  <div key={endpoint.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge color={getStatusColor(endpoint.status)} />
                      <Text className="text-sm">{endpoint.name}</Text>
                    </div>
                    <Text className="text-sm text-gray-500">{endpoint.latency}ms</Text>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabPane>
      </Tabs>
    </Drawer>
  )
}
