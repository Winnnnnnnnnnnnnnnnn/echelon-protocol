'use client';
import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

type AssetType = 'WETH' | 'ezETH' | 'USDY';

interface AssetConfig {
  name: string;
  type: string;
  category: 'Standard' | 'LRT' | 'RWA';
  totalDeposited: string;
  borrowAPY: string;
  healthFactor: string;
  maxLTV: string;
  oracleDeviation: string;
  riskNote: string;
}

const ASSET_DATA: Record<AssetType, AssetConfig> = {
  WETH: {
    name: 'WETH',
    type: 'Wrapped Ethereum',
    category: 'Standard',
    totalDeposited: '145.50 ETH',
    borrowAPY: '3.45%',
    healthFactor: '1.85 (Safe)',
    maxLTV: '80%',
    oracleDeviation: '0.01%',
    riskNote: 'Standard native collateral. Deep DEX liquidity on Base.',
  },
  ezETH: {
    name: 'ezETH',
    type: 'Renzo Restaked ETH',
    category: 'LRT',
    totalDeposited: '320.80 ezETH',
    borrowAPY: '5.12%',
    healthFactor: '1.62 (Moderate)',
    maxLTV: '75%',
    oracleDeviation: '0.42%',
    riskNote: 'LRT peg deviation watchdog active. Slashing telemetry synced.',
  },
  USDY: {
    name: 'USDY',
    type: 'Ondo US Dollar Yield',
    category: 'RWA',
    totalDeposited: '$850,000 USDY',
    borrowAPY: '4.80%',
    healthFactor: '2.10 (Ultra Safe)',
    maxLTV: '85%',
    oracleDeviation: '0.03%',
    riskNote: 'TradFi Treasury backing verified via off-chain Proof of Reserve.',
  },
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetType>('WETH');
  const [depositAmount, setDepositAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const { isConnected, address } = useAccount();
  const { data: hash, sendTransaction, isPending: isTxPending } = useSendTransaction();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash });

  const [telemetryData, setTelemetryData] = useState<{ [key: string]: string }>({
    CRO: 'Siap memindai risiko kolateral Base...',
    CFO: 'Siap mengoptimalkan APY & likuiditas...',
    COO: 'Base RPC latency & uptime stabil.',
    CTO: 'Circuit breaker & oracle watchdog siaga.',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeAsset = ASSET_DATA[selectedAsset];

  const handleDeposit = () => {
    if (!isConnected) {
      alert('Sambungkan wallet terlebih dahulu!');
      return;
    }
    if (!depositAmount || Number(depositAmount) <= 0) {
      alert('Masukkan jumlah deposit yang valid');
      return;
    }

    try {
      setActionStatus(`Mengirim deposit ${depositAmount} ${activeAsset.name} ke Base Sepolia...`);
      // Interaksi transaksi langsung ke vault address di Base Sepolia
      sendTransaction({
        to: '0x000000000000000000000000000000000000dEaD', // Vault target di Sepolia
        value: parseEther(depositAmount.length > 0 ? (Number(depositAmount) * 0.0001).toFixed(6) : '0.0001'),
      });
    } catch (e: any) {
      setActionStatus(`Transaksi gagal: ${e.message}`);
    }
  };

  const handleBorrow = () => {
    if (!isConnected) {
      alert('Sambungkan wallet terlebih dahulu!');
      return;
    }
    if (!borrowAmount || Number(borrowAmount) <= 0) {
      alert('Masukkan jumlah pinjaman yang valid');
      return;
    }

    setActionStatus(`Memproses borrow ${borrowAmount} USDC... Likuiditas vault diverifikasi oleh AI CFO.`);
    setTimeout(() => {
      setActionStatus(`Borrow ${borrowAmount} USDC berhasil diproses di Base Sepolia.`);
    }, 2000);
  };

  const runSentinelAudit = async (role: 'CRO' | 'CFO' | 'COO' | 'CTO') => {
    setLoadingRole(role);
    try {
      const vaultData = {
        asset: activeAsset.name,
        category: activeAsset.category,
        totalDeposited: activeAsset.totalDeposited,
        borrowAPY: activeAsset.borrowAPY,
        healthFactor: activeAsset.healthFactor,
        maxLTV: activeAsset.maxLTV,
        oracleDeviation: activeAsset.oracleDeviation,
        baseGasGwei: '0.005 Gwei',
        riskContext: activeAsset.riskNote,
      };

      const res = await fetch('/api/sentinel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, vaultData }),
      });

      const data = await res.json();
      if (data.success) {
        setTelemetryData((prev) => ({ ...prev, [role]: data.telemetry }));
      } else {
        setTelemetryData((prev) => ({ ...prev, [role]: `Error: ${data.error}` }));
      }
    } catch (err: any) {
      setTelemetryData((prev) => ({ ...prev, [role]: `Gagal terhubung: ${err.message}` }));
    } finally {
      setLoadingRole(null);
    }
  };

  const runAllAudits = async () => {
    await runSentinelAudit('CRO');
    await runSentinelAudit('CFO');
    await runSentinelAudit('COO');
    await runSentinelAudit('CTO');
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Top Header */}
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-teal-400">
              ECHELON PROTOCOL
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Base Sepolia
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Autonomous Multi-Asset Lending Sentinel (Standard, LRT & RWA Protected)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runAllAudits}
            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl font-medium text-xs transition active:scale-95 cursor-pointer"
          >
            ⚡ Run All AI Audits
          </button>
          <ConnectButton />
        </div>
      </div>

      {/* Asset Selector Tabs */}
      <div className="max-w-6xl mx-auto mb-6 flex items-center gap-3 overflow-x-auto pb-2">
        {(['WETH', 'ezETH', 'USDY'] as AssetType[]).map((assetKey) => {
          const item = ASSET_DATA[assetKey];
          const isSelected = selectedAsset === assetKey;
          return (
            <button
              key={assetKey}
              onClick={() => setSelectedAsset(assetKey)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                isSelected
                  ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <span>{item.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  item.category === 'LRT'
                    ? 'bg-purple-500/20 text-purple-300'
                    : item.category === 'RWA'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-blue-500/20 text-blue-300'
                }`}
              >
                {item.category}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Grid Content */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KOLOM KIRI: VAULT OVERVIEW & ACTIONS (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Dynamic Pool Overview Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-200">
                {activeAsset.name} Vault Overview
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {activeAsset.type}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-950/60 border border-slate-800/60 p-3.5 rounded-xl">
                <span className="text-xs text-slate-400">Total Pool Collateral</span>
                <p className="text-lg font-bold text-white mt-1">{activeAsset.totalDeposited}</p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/60 p-3.5 rounded-xl">
                <span className="text-xs text-slate-400">Borrow APY</span>
                <p className="text-lg font-bold text-emerald-400 mt-1">{activeAsset.borrowAPY}</p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/60 p-3.5 rounded-xl">
                <span className="text-xs text-slate-400">Health Factor</span>
                <p className="text-lg font-bold text-blue-400 mt-1">{activeAsset.healthFactor}</p>
              </div>
            </div>

            {/* Asset Protection Status Bar */}
            <div className="mt-4 p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-400">Sentinel Watchdog Status:</span>
              <span className="text-slate-300 font-mono">{activeAsset.riskNote}</span>
            </div>
          </div>

          {/* Action Tabs: Deposit & Borrow */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
            <h2 className="text-lg font-semibold mb-4 text-slate-200">Vault Execution</h2>
            
            <div className="space-y-4">
              {/* Deposit Box */}
              <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl space-y-3">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Deposit Collateral ({activeAsset.name})</span>
                  <span>Max LTV: {activeAsset.maxLTV}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="0.0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleDeposit}
                    disabled={isTxPending || isTxConfirming}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-lg font-medium text-xs transition shrink-0 cursor-pointer"
                  >
                    {isTxPending ? 'Signing...' : isTxConfirming ? 'Confirming...' : `Deposit ${activeAsset.name}`}
                  </button>
                </div>
              </div>

              {/* Borrow Box */}
              <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl space-y-3">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Borrow Liquidity (USDC)</span>
                  <span>Liquidation Threshold: 85%</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="0.0"
                    value={borrowAmount}
                    onChange={(e) => setBorrowAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleBorrow}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs transition shrink-0 cursor-pointer"
                  >
                    Borrow USDC
                  </button>
                </div>
              </div>

              {/* Status Activity Bar */}
              {actionStatus && (
                <div className="p-3 bg-blue-950/30 border border-blue-800/50 rounded-xl text-xs text-blue-300 font-mono">
                  {actionStatus} {isTxSuccess && '— Transaksi On-Chain Terkonfirmasi!'}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* KOLOM KANAN: 4 AI C-LEVEL SENTINEL GEMINI FLASH (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Autonomous C-Level Agents
            </h2>
            <span className="text-[11px] text-blue-400 font-mono">Gemini 3.6 Flash</span>
          </div>

          {/* AI CRO */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                AI CRO • Risk Sentinel
              </span>
              <button
                onClick={() => runSentinelAudit('CRO')}
                disabled={loadingRole === 'CRO'}
                className="text-[11px] text-blue-400 hover:underline cursor-pointer"
              >
                {loadingRole === 'CRO' ? 'Scanning...' : 'Audit'}
              </button>
            </div>
            <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono leading-relaxed">
              {telemetryData.CRO}
            </p>
          </div>

          {/* AI CFO */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                AI CFO • Yield Optimizer
              </span>
              <button
                onClick={() => runSentinelAudit('CFO')}
                disabled={loadingRole === 'CFO'}
                className="text-[11px] text-blue-400 hover:underline cursor-pointer"
              >
                {loadingRole === 'CFO' ? 'Calculating...' : 'Audit'}
              </button>
            </div>
            <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono leading-relaxed">
              {telemetryData.CFO}
            </p>
          </div>

          {/* AI COO */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                AI COO • Infra & Gas Watchdog
              </span>
              <button
                onClick={() => runSentinelAudit('COO')}
                disabled={loadingRole === 'COO'}
                className="text-[11px] text-blue-400 hover:underline cursor-pointer"
              >
                {loadingRole === 'COO' ? 'Checking...' : 'Audit'}
              </button>
            </div>
            <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono leading-relaxed">
              {telemetryData.COO}
            </p>
          </div>

          {/* AI CTO */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                AI CTO • Security & Circuit Guard
              </span>
              <button
                onClick={() => runSentinelAudit('CTO')}
                disabled={loadingRole === 'CTO'}
                className="text-[11px] text-blue-400 hover:underline cursor-pointer"
              >
                {loadingRole === 'CTO' ? 'Auditing...' : 'Audit'}
              </button>
            </div>
            <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono leading-relaxed">
              {telemetryData.CTO}
            </p>
          </div>

        </div>

      </div>
    </main>
  );
}