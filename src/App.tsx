import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';

const Dashboard = lazy(()=>import('@/pages/Dashboard'));
const Loans = lazy(()=>import('@/pages/Loans'));
const AddLoan = lazy(()=>import('@/pages/AddLoan'));
const EMISchedule = lazy(()=>import('@/pages/EMISchedule'));
const Reports = lazy(()=>import('@/pages/Reports'));
const Settings = lazy(()=>import('@/pages/Settings'));
const Finance = lazy(()=>import('@/pages/Finance'));

function Loading(){
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#334155] border-t-[#22c55e] rounded-full animate-spin" />
        <p className="text-[13px] text-slate-500">Loading...</p>
      </div>
    </div>
  );
}

export default function App(){
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/loans/:id" element={<EMISchedule />} />
            <Route path="/add" element={<AddLoan />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={
              <div className="text-center py-20">
                <p className="text-[24px]">404</p>
                <p className="text-slate-500">Page not found</p>
                <a href="/" className="mt-4 inline-block text-[#22c55e] hover:underline">Go Dashboard</a>
              </div>
            } />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
