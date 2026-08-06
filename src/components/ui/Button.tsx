import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ variant='primary', size='md', loading, className='', children, ...props }) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-[14px]',
    lg: 'px-6 py-3 text-[15px]'
  };
  const variants = {
    primary: 'bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-lg shadow-[#22c55e]/20',
    secondary: 'bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#334155]',
    danger: 'bg-[#ef4444] hover:bg-[#dc2626] text-white shadow-lg shadow-[#ef4444]/20',
    ghost: 'bg-transparent hover:bg-[#1e293b] text-slate-300',
    outline: 'bg-transparent border border-[#334155] hover:bg-[#1e293b] text-slate-200'
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <span className="animate-spin mr-2 w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />}
      {children}
    </button>
  );
};
