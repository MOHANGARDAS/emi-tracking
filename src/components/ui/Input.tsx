import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, hint, className='', ...props }) => {
  return (
    <div className="w-full space-y-1.5">
      {label && <label className="text-[13px] font-medium text-slate-300 tracking-wide">{label}</label>}
      <input
        className={`w-full px-3.5 py-2.5 bg-[#1e293b] border ${error ? 'border-[#ef4444] focus:ring-[#ef4444]/20' : 'border-[#334155] focus:border-[#3b82f6] focus:ring-[#3b82f6]/20'} rounded-xl text-[14px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-4 transition-all ${className}`}
        {...props}
      />
      {error && <p className="text-[12px] text-[#ef4444]">{error}</p>}
      {hint && !error && <p className="text-[12px] text-slate-500">{hint}</p>}
    </div>
  );
};

export const Select: React.FC<{ label?: string; error?: string; children: React.ReactNode; className?: string } & React.SelectHTMLAttributes<HTMLSelectElement>> = ({ label, error, children, className='', ...props }) => {
  return (
    <div className="w-full space-y-1.5">
      {label && <label className="text-[13px] font-medium text-slate-300 tracking-wide">{label}</label>}
      <select
        className={`w-full px-3.5 py-2.5 bg-[#1e293b] border ${error ? 'border-[#ef4444]' : 'border-[#334155]'} rounded-xl text-[14px] text-slate-100 focus:outline-none focus:border-[#3b82f6] focus:ring-4 focus:ring-[#3b82f6]/20 transition-all ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[12px] text-[#ef4444]">{error}</p>}
    </div>
  );
};

export const Textarea: React.FC<{ label?: string; error?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ label, error, className='', ...props }) => {
  return (
    <div className="w-full space-y-1.5">
      {label && <label className="text-[13px] font-medium text-slate-300">{label}</label>}
      <textarea className={`w-full px-3.5 py-2.5 bg-[#1e293b] border ${error ? 'border-[#ef4444]' : 'border-[#334155]'} rounded-xl text-[14px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#3b82f6] focus:ring-4 focus:ring-[#3b82f6]/20 min-h-[80px] resize-none ${className}`} {...props} />
      {error && <p className="text-[12px] text-[#ef4444]">{error}</p>}
    </div>
  );
};
