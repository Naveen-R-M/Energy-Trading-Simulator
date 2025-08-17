import React, { useEffect, useState } from 'react';

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
  da_price?: number | null;
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

interface RTPrice {
  data: Array<{
    interval_start_utc: string;
    interval_end_utc: string;
    location: string;
    lmp: number;
  }>;
}

// P&L calculation function exactly as specified
function calcLivePnl(order: Order, latestRtByLoc: Record<string, number | null>): number | null {
  const Q = order.qty_mwh ?? 0;
  const DA = order.da_price ?? order.limit_price;
  const rt = latestRtByLoc[order.location] ?? order.approval_rt_lmp ?? null;
  
  if (rt == null || DA == null) return null;
  
  const sideMult = order.side === "BUY" ? 1 : -1;
  return (rt - DA) * Q * sideMult;
}

const PositionsTable: React.FC<{ orders: Order[] }> = ({ orders }) => {
  const [latestRtPrices, setLatestRtPrices] = useState<Record<string, number | null>>({});

  useEffect(() => {
    // Get unique locations from orders
    const locations = [...new Set(orders.map(order => order.location))];
    
    // Fetch latest RT prices for all locations
    const fetchRTPrices = async () => {
      const rtPrices: Record<string, number | null> = {};
      
      for (const location of locations) {
        try {
          const response = await fetch(`/api/v1/realtime/latest?market=pjm&location=${location}`);
          if (response.ok) {
            const data: RTPrice = await response.json();
            if (data.data && data.data.length > 0) {
              rtPrices[location] = data.data[0].lmp;
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
      
      // Poll every 5 minutes as RT data is published every 5 minutes
      const interval = setInterval(fetchRTPrices, 5 * 60 * 1000); // 5 minutes
      return () => clearInterval(interval);
    }
  }, [orders]);

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
      const utc = date.toISOString();
      return (
        <span title={`UTC: ${utc}`} className="cursor-help">
          {et}
        </span>
      );
    } catch {
      return '—';
    }
  };

  const SideBadge = ({ side }: { side: string }) => (
    <span className={`px-2 py-1 rounded text-xs font-medium ${
      side === 'BUY' 
        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    }`}>
      {side}
    </span>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusColor = (status: string) => {
      switch (status?.toUpperCase()) {
        case 'PENDING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
        case 'APPROVED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        case 'CLEARED': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case 'REJECTED': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
        case 'UNFILLED': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      }
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(status)}`}>
        {status || 'PENDING'}
      </span>
    );
  };

  const ProgressPill = ({ status }: { status: string }) => {
    const getProgress = (status: string) => {
      switch (status?.toUpperCase()) {
        case 'PENDING': return { width: '33%', text: 'PENDING' };
        case 'APPROVED': return { width: '66%', text: 'APPROVED' };
        case 'CLEARED': return { width: '100%', text: 'CLEARED' };
        case 'REJECTED': return { width: '0%', text: 'REJECTED' };
        case 'UNFILLED': return { width: '0%', text: 'UNFILLED' };
        default: return { width: '33%', text: 'PENDING' };
      }
    };

    const progress = getProgress(status);

    return (
      <div className="w-24">
        <div className="bg-gray-200 rounded-full h-2 dark:bg-gray-700 mb-1">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              status?.toUpperCase() === 'REJECTED' || status?.toUpperCase() === 'UNFILLED' 
                ? 'bg-red-600' 
                : 'bg-blue-600'
            }`}
            style={{ width: progress.width }}
          />
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400">{progress.text}</div>
      </div>
    );
  };

  const formatPnL = (pnl: number | null) => {
    if (pnl === null || pnl === undefined) return '—';
    const formatted = pnl.toFixed(2);
    const color = pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    return <span className={color}>${formatted}</span>;
  };

  const getDALMP = (order: Order) => {
    const price = order.da_price ?? order.limit_price;
    const isBidOffer = !order.da_price; // If no da_price, it's a bid/offer
    
    return (
      <span title={isBidOffer ? "Bid/Offer Price" : "DA Clearing Price"}>
        ${price?.toFixed(2) || '—'}
        {isBidOffer && <span className="text-xs text-gray-500 ml-1">(Bid)</span>}
      </span>
    );
  };

  const getLivePnL = (order: Order) => {
    // For REJECTED/UNFILLED, P&L is always 0
    if (['REJECTED', 'UNFILLED'].includes(order.status?.toUpperCase())) {
      return formatPnL(0);
    }
    
    // Calculate using the specified formula
    const pnl = calcLivePnl(order, latestRtPrices);
    return formatPnL(pnl);
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <div className="text-lg mb-2">No open positions</div>
        <div className="text-sm">Submit trades to see positions here</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Hour
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              DA LMP
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Side
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Quantity
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Progress
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Approval LMP
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Live P&L
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {formatHour(order.hour_start_utc)}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {getDALMP(order)}
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <SideBadge side={order.side} />
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {order.qty_mwh} MWh
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <ProgressPill status={order.status} />
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                {order.approval_rt_lmp ? `$${order.approval_rt_lmp.toFixed(2)}` : '—'}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                {getLivePnL(order)}
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <StatusBadge status={order.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PositionsManager: React.FC = () => {
  const [data, setData] = useState<FetchOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');

  useEffect(() => {
    fetchOrders();
  }, []);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Positions Management
          </h1>
        </div>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Positions Management
          </h1>
        </div>
        <div className="bg-red-50 dark:bg-red-900 p-4 rounded-lg">
          <div className="text-red-800 dark:text-red-200">
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
    );
  }

  if (!data) return null;

  const openOrders = data.open.orders;
  const closedOrders = data.closed.orders;
  const currentOrders = activeTab === 'open' ? openOrders : closedOrders;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Positions Management
        </h1>
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <span>👁</span>
          <span>Projected P&L</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('open')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'open'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
            }`}
          >
            Open Positions ({data.open.count})
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'closed'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
            }`}
          >
            Closed Positions ({data.closed.count})
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <PositionsTable orders={currentOrders} />
      </div>
    </div>
  );
};

export default PositionsManager;