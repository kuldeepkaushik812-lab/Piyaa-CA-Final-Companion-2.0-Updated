import React from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { Activity } from 'lucide-react';
import { StudyHistoryLog } from '../types';

export const FocusEfficiencyChart = ({ sessions }: { sessions: any[] }) => {
  // Group sessions by hour to show activity throughout the day
  const hourlyData = Array.from({ length: 24 }).map((_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    duration: 0,
    count: 0
  }));

  sessions.forEach(session => {
    const date = new Date(session.timestamp);
    const hourIndex = date.getHours();
    hourlyData[hourIndex].duration += session.durationHours || (session.effectiveMs / 3600000) || 0;
    hourlyData[hourIndex].count += 1;
  });

  // Filter to show from first active hour to last active hour for better view, or a fixed range if empty
  const activeIndices = hourlyData.map((d, i) => d.duration > 0 ? i : -1).filter(i => i !== -1);
  const minActive = activeIndices.length > 0 ? Math.max(0, Math.min(...activeIndices) - 1) : 6;
  const maxActive = activeIndices.length > 0 ? Math.min(23, Math.max(...activeIndices) + 1) : 22;
  
  const displayData = hourlyData.slice(minActive, maxActive + 1);

  if (sessions.length === 0) {
    return (
      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex items-center justify-center min-h-[160px] mb-4">
        <p className="text-sm text-slate-500">No focus sessions logged today yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-emerald-500" />
        <h3 className="text-sm font-semibold text-slate-300">Focus Efficiency Today</h3>
      </div>
      <div className="h-[140px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.5} />
            <XAxis 
              dataKey="hour" 
              stroke="#64748b" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#64748b" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}h`}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.5rem', fontSize: '12px' }}
              itemStyle={{ color: '#10b981' }}
              labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
              formatter={(value: number) => [`${value.toFixed(2)} hrs`, 'Focused Time']}
            />
            <Area 
              type="monotone" 
              dataKey="duration" 
              stroke="#10b981" 
              fillOpacity={1} 
              fill="url(#colorDuration)" 
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
