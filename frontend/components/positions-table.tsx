import React from 'react';

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

interface PositionsTableProps {
  orders: Order[];
}

const PositionsTable: React.FC<PositionsTableProps> = ({ orders }) => {
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
        <div className="text-xs text-muted-foreground">{progress.text}</div>
      </div>
    );
  };

  const getDALMP = (order: Order) => {
    const price = order.limit_price;
    
    return (
      <span title="Bid/Offer Price">
        ${price?.toFixed(2) || '—'}
        <span className="text-xs text-muted-foreground ml-1">(Bid)</span>
      </span>
    );
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
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
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Hour
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              DA LMP
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Side
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Quantity
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Progress
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Approval LMP
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Live P&L
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-4 py-4 whitespace-nowrap text-sm text-foreground">
                {formatHour(order.hour_start_utc)}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-foreground">
                {getDALMP(order)}
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <SideBadge side={order.side} />
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-foreground">
                {order.qty_mwh} MWh
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <ProgressPill status={order.status} />
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                {order.approval_rt_lmp ? `$${order.approval_rt_lmp.toFixed(2)}` : '—'}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-muted-foreground">
                —
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

export default PositionsTable;