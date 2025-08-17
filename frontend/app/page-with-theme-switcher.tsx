"use client"

import { useState, useEffect } from "react"
import { ConfigProvider } from "@arco-design/web-react"
import "@arco-design/web-react/dist/css/arco.css"
import "./glass-theme.css"

// Import both theme versions
import EnergyTradingAppGlass from "./page-glass-redesign"
import EnergyTradingApp from "./page-legacy"

export default function EnergyTradingAppSwitcher() {
  const [useGlassTheme, setUseGlassTheme] = useState(false)

  // Theme toggle in top-right corner
  const ThemeToggle = () => (
    <div 
      className="fixed top-4 right-4 z-50 rounded-full p-3 border border-white/40 shadow-lg transition-all hover:scale-105"
      style={{
        background: useGlassTheme 
          ? 'rgba(255, 255, 255, 0.6)' 
          : 'rgba(26, 35, 50, 0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}
    >
      <button
        onClick={() => setUseGlassTheme(!useGlassTheme)}
        className={`flex items-center gap-2 text-sm font-medium transition-colors ${
          useGlassTheme 
            ? 'text-slate-700 hover:text-slate-900' 
            : 'text-white hover:text-gray-200'
        }`}
        title={`Switch to ${useGlassTheme ? 'Dark' : 'Glass'} Theme`}
      >
        {useGlassTheme ? (
          <>
            🌙 <span className="hidden sm:inline">Dark Theme</span>
          </>
        ) : (
          <>
            ✨ <span className="hidden sm:inline">Glass Theme</span>
          </>
        )}
      </button>
    </div>
  )

  return (
    <ConfigProvider>
      <ThemeToggle />
      
      {/* Render appropriate theme */}
      {useGlassTheme ? <EnergyTradingAppGlass /> : <EnergyTradingApp />}
    </ConfigProvider>
  )
}

// Export the data types for compatibility
export interface LMPData {
  timestamp: string
  lmp: number
  energy: number
  congestion: number
  loss: number
}

export interface TradePosition {
  id: string
  hour: number
  side: "Buy" | "Sell"
  quantity: number
  daLmp: number
  filledIntervals: number
  livePL: number
  projectedPL?: number
}
