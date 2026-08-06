import React from 'react';

export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className='', onClick }) => {
  return (
    <div onClick={onClick} className={`bg-[#1e293b] border border-[#334155]/60 rounded-[16px] ${onClick ? 'cursor-pointer hover:border-[#475569] hover:bg-[#23304a] transition-all' : ''} ${className}`}>
      {children}
    </div>
  );
};

export const StatCard: React.FC<{ title: string; value: string | number; sub?: string; icon?: React.ReactNode; color?: string }> = ({ title, value, sub, icon, color='primary' }) => {
  const colorMap: any = {
    primary: 'text-[#22c55e] bg-[#22c55e]/10',
    warning: 'text-[#f59e0b] bg-[#f59e0b]/10',
    danger: 'text-[#ef4444] bg-[#ef4444]/10',
    accent: 'text-[#3b82f6] bg-[#3b82f6]/10',
    slate: 'text-slate-400 bg-slate-800'
  };
  return (
    <div className="bg-[#1e293b] border border-[#334155]/60 rounded-[16px] p-4 flex flex-col gap-3 hover:border-[#334155] transition-colors">
      <div className="flex justify-between items-start">
        <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wider leading-tight">{title}</p>
        {icon && <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorMap[color]}`}>{icon}</div>}
      </div>
      <div>
        <p className="text-[22px] font-bold text-slate-100 leading-none tracking-tight">{value}</p>
        {sub && <p className="text-[12px] text-slate-500 mt-1.5">{sub}</p>}
      </div>
    </div>
  );
};
