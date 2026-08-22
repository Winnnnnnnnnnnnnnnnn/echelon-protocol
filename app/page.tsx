'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ShieldCheck, Activity, Zap, TrendingUp, AlertCircle } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      {/* Navbar */}
      <header className="max-w-6xl mx-auto flex justify-between items-center pb-8 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/30">
            E
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">ECHELON</h1>
            <p className="text-xs text-blue-400 font-medium">AI-Sentinel Lending on Base</p>
          </div>
        </div>
        <ConnectButton showBalance={false} />
      </header>

      {/* Main Grid */}
      <div className="max-w-6xl mx-auto mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center text-slate-400 text-sm">
            <span>Total Value Locked (TVL)</span>
            <TrendingUp className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-3xl font-extrabold mt-3 tracking-tight">$125,400.00</p>
          <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-medium">
            ▲ +14.2% Base Sepolia Pool
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center text-slate-400 text-sm">
            <span>Vault Health Factor</span>
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-extrabold mt-3 tracking-tight text-emerald-400">1.85</p>
          <p className="text-xs text-slate-400 mt-2 font-medium">Safe Margin (&gt; 1.20)</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center text-slate-400 text-sm">
            <span>AI Risk Sentinel Status</span>
            <Activity className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-3xl font-extrabold mt-3 tracking-tight text-blue-400">Active</p>
          <p className="text-xs text-slate-400 mt-2 font-medium">Multi-Agent Telegram Synced</p>
        </div>
      </div>

      {/* Action Box */}
      <div className="max-w-6xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vault Actions */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-400" />
            Lending & Collateral Vault
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 font-medium">Deposit Asset (cbBTC / ETH)</label>
              <div className="mt-1 flex rounded-xl bg-slate-950 border border-slate-800 p-2">
                <input
                  type="text"
                  placeholder="0.0"
                  className="bg-transparent w-full px-2 outline-none text-sm"
                />
                <button className="bg-blue-600 hover:bg-blue-500 text-xs px-4 py-2 rounded-lg font-semibold transition">
                  Deposit
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium">Borrow Capacity (USDC)</label>
              <div className="mt-1 flex rounded-xl bg-slate-950 border border-slate-800 p-2">
                <input
                  type="text"
                  placeholder="0.0"
                  className="bg-transparent w-full px-2 outline-none text-sm"
                />
                <button className="bg-slate-800 hover:bg-slate-700 text-xs px-4 py-2 rounded-lg font-semibold transition">
                  Borrow
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AI Sentinel Feed */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-emerald-400" />
            AI Sentinel Live Telemetry
          </h2>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span className="font-semibold text-blue-400">[AI CRO] Risk Assessment</span>
                <span>Just now</span>
              </div>
              <p className="text-slate-300">Base volatility index is nominal. Liquidation risk across active vaults is 0.02%.</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span className="font-semibold text-emerald-400">[AI CFO] Yield Optimization</span>
                <span>2m ago</span>
              </div>
              <p className="text-slate-300">Collateral utilization optimal at 68.4%. No rebalancing needed.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}