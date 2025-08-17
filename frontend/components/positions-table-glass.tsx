"use client"

import { useState, useEffect } from "react"
import { Card, Typography, Button, Badge, Divider, Tabs } from "@arco-design/web-react"
import { IconUser, IconTrendingUp, IconTrendingDown } from "@arco-design/web-react/icon"

const { Title, Text } = Typography
const { TabPane } = Tabs

interface Order {
  id: string;
  created_at: string;
  market: string;
  location_type: string;
  location: string;
  hour_start_utc: string;
  side: 'BUY' | 'SELL';
  qty_mwh: number;
  limit_price: number;
  status: string;
  approved_at?: string;
  approval_rt_interval_start_utc?: string;
  approval_rt_lmp?: number;
  approval_rt_source?: string;
  reject_reason?: string;
}

interface FetchOrdersResponse {
  open: {
    count: number;
    orders: Order[];
  };
  closed: {
    count: number;
    orders: Order[];
  };
}

interface PositionsTableGlassProps {
  positions: any[] // Keep for compatibility
  currentTime: Date
}

export default function PositionsTableGlass({ positions, currentTime }: PositionsTableGlassProps) {
  const [data, setData] = useState<FetchOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("open");
  const [latestRtPrices, setLatestRtPrices] = useState<Record<string, number | null>>({});

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (data) {
      const allOrders = [...data.open.orders, ...data.closed.orders];
      const locations = [...new Set(allOrders.map(order => order.location))];
      
      const fetchRTPrices = async () => {
        const rtPrices: Record<string, number | null> = {};
        
        for (const location of locations) {
          try {
            const response = await fetch(`/api/v1/realtime/latest?market=pjm&location=${location}`);
            if (response.ok) {
              const rtData = await response.json();
              if (rtData.data && rtData.data.length > 0) {
                rtPrices[location] = rtData.data[0].lmp;
              }
            }
          } catch (error) {
            console.error(`Error fetching RT price for ${location}:`, error);
            rtPrices[location] = null;
          }
        }
        
        setLatestRtPrices(rtPrices);
      };

      if (locations.length > 0) {
        fetchRTPrices();
        const interval = setInterval(fetchRTPrices, 5 * 60 * 1000); // 5 minutes
        return () => clearInterval(interval);
      }
    }
  }, [data]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/v1/fetch_orders');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }
      
      const result: FetchOrdersResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // P&L calculation function
  function calcLivePnl(order: Order, latestRtByLoc: Record<string, number | null>): number | null {
    if (['REJECTED', 'UNFILLED'].includes(order.status?.toUpperCase())) {
      return 0;
    }

    const Q = order.qty_mwh ?? 0;
    const DA = order.limit_price; // Using limit_price as DA placeholder
    const rt = latestRtByLoc[order.location] ?? order.approval_rt_lmp ?? null;
    
    if (rt == null || DA == null) return null;
    
    const sideMult = order.side === "BUY" ? 1 : -1;
    return (rt - DA) * Q * sideMult;
  }

  const formatHour = (dateString: string) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      const et = date.toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        hour12: true 
      });
      return et;
    } catch {
      return '—';
    }
  };

  const formatPL = (value: number | null) => {
    if (value === null || value === undefined) return { formatted: '—', color: 'text-slate-500' };
    const formatted = Math.abs(value).toFixed(2);
    const sign = value >= 0 ? "+" : "-";
    const color = value >= 0 ? "text-green-600" : "text-red-600";
    return { formatted: `${sign}$${formatted}`, color };
  };

  if (loading) {
    return (
      <div 
        className="rounded-2xl p-6 border border-white/40 shadow-sm"
        style={{
          background: 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(12px)'
        }}
      >
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-900">Positions Management</h3>
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="rounded-2xl p-6 border border-white/40 shadow-sm"
        style={{
          background: 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(12px)'
        }}
      >
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-900">Positions Management</h3>
          <div className="bg-red-50/80 p-4 rounded-lg backdrop-blur-sm">
            <div className="text-red-800">
              <strong>Error:</strong> {error}
            </div>
            <button
              onClick={fetchOrders}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const openOrders = data.open.orders;
  const closedOrders = data.closed.orders;

  // Calculate total P&L
  const calculateTotalPnL = (orders: Order[]) => {
    return orders.reduce((total, order) => {
      const pnl = calcLivePnl(order, latestRtPrices);
      return total + (pnl || 0);
    }, 0);
  };

  const totalPnL = calculateTotalPnL([...openOrders, ...closedOrders]);

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
            Positions Management
          </h3>
          <div className="text-right">
            <div className="text-sm text-slate-600">Total P&L</div>
            <div className={`text-lg font-semibold ${formatPL(totalPnL).color}`}>
              {formatPL(totalPnL).formatted}
            </div>
          </div>
        </div>

        {/* Projected P&L Chart Placeholder */}
        <div className="space-y-3">
          <div className="text-sm text-slate-600 font-medium">Projected P&L</div>
          
          <div className="h-12 relative">
            <div 
              className="w-full h-full rounded-lg opacity-60"
              style={{
                background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.3) 0%, rgba(99, 102, 241, 0.3) 50%, rgba(139, 92, 246, 0.3) 100%)',
                backdropFilter: 'blur(4px)'
              }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-slate-500">
            <span>0</span>
            <span>0:00</span>
            <span>120</span>
          </div>
        </div>

        {/* Position Tabs */}
        <div className="space-y-4">
          {/* Tab Headers */}
          <div className="flex border-b border-white/30">
            <button
              onClick={() => setActiveTab("open")}
              className={`text-sm font-medium pb-2 px-1 border-b-2 transition-colors ${
                activeTab === "open"
                  ? "text-blue-600 border-blue-600"
                  : "text-slate-600 border-transparent hover:text-slate-800"
              }`}
            >
              Open Positions ({data.open.count})
            </button>
            <button
              onClick={() => setActiveTab("closed")}
              className={`text-sm font-medium pb-2 px-4 ml-4 border-b-2 transition-colors ${
                activeTab === "closed"
                  ? "text-blue-600 border-blue-600"
                  : "text-slate-600 border-transparent hover:text-slate-800"
              }`}
            >
              Closed Positions ({data.closed.count})
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[200px]">
            {activeTab === "open" && (
              <div>
                {openOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-slate-500 text-sm mb-2">No open positions</div>
                    <div className="text-slate-400 text-sm">Submit trades to see positions here</div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {openOrders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-xl p-4 border border-white/40 hover:bg-white/30 transition-colors"
                        style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          backdropFilter: 'blur(6px)'
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              order.side === "BUY" ? "bg-green-500" : "bg-red-500"
                            }`} />
                            <div>
                              <div className="text-sm font-medium text-slate-900">
                                {order.side} {order.qty_mwh} MWh
                              </div>
                              <div className="text-xs text-slate-600">
                                {formatHour(order.hour_start_utc)} @ ${order.limit_price.toFixed(2)}
                              </div>
                              <div className="text-xs text-slate-500">
                                {order.status}
                                {order.approval_rt_lmp && ` • RT: $${order.approval_rt_lmp.toFixed(2)}`}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-medium ${formatPL(calcLivePnl(order, latestRtPrices)).color}`}>
                              {formatPL(calcLivePnl(order, latestRtPrices)).formatted}
                            </div>
                            <div className="text-xs text-slate-500">Live P&L</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "closed" && (
              <div>
                {closedOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-slate-500 text-sm">No closed positions</div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {closedOrders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-xl p-4 border border-white/40"
                        style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          backdropFilter: 'blur(6px)'
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              order.status === 'APPROVED' ? 'bg-green-500' : 
                              order.status === 'REJECTED' ? 'bg-red-500' : 'bg-slate-400'
                            }`} />
                            <div>
                              <div className="text-sm font-medium text-slate-900">
                                {order.side} {order.qty_mwh} MWh
                              </div>
                              <div className="text-xs text-slate-600">
                                {formatHour(order.hour_start_utc)} @ ${order.limit_price.toFixed(2)}
                              </div>
                              <div className="text-xs text-slate-500">
                                {order.status}
                                {order.approval_rt_lmp && ` • RT: $${order.approval_rt_lmp.toFixed(2)}`}
                                {order.reject_reason && ` • ${order.reject_reason}`}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-medium ${formatPL(calcLivePnl(order, latestRtPrices)).color}`}>
                              {formatPL(calcLivePnl(order, latestRtPrices)).formatted}
                            </div>
                            <div className="text-xs text-slate-500">
                              {order.status === 'APPROVED' ? 'Live P&L' : 'Final P&L'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        {(!data || (data.open.count === 0 && data.closed.count === 0)) && (
          <div className="text-center py-12">
            <div className="text-slate-500 text-sm mb-2">Submit trades to see positions</div>
          </div>
        )}
      </div>
    </div>
  )
}