'use client';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { MONTHS_SHORT } from '@/lib/dates';
import { money } from '@/lib/format';

const compact = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : v);

export function MonthlyCollectionChart({ monthly }) {
  const data = monthly.map((m) => ({ name: MONTHS_SHORT[m.month - 1], Paid: m.paid, 'By advance': m.advanceCovered, Pending: m.pending }));
  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="#E3E8EF" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
          <YAxis tickFormatter={compact} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
          <Tooltip formatter={(v) => money(v)} cursor={{ fill: 'rgba(14,31,61,0.04)' }} contentStyle={{ borderRadius: 10, border: '1px solid #E3E8EF', fontSize: 13 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#64748B' }} />
          <Bar dataKey="Paid" stackId="a" fill="#0F8F63" />
          <Bar dataKey="By advance" stackId="a" fill="#6FCBA5" />
          <Bar dataKey="Pending" stackId="a" fill="#E7A29E" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
