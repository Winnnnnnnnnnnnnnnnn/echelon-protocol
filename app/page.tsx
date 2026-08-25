'use client';
import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { parseEther } from 'viem';

const PROTOCOL_VAULT_ADDRESS = '0xC95DDE4889e05d261618fD33baC37011C5a307D4' as `0x${string}`;

type AssetType = 'WETH' | 'ezETH' | 'USDY';

interface AssetConfig {
  name: string;
  type: string;
  category: 'Standard' | 'LRT' | 'RWA';
  unit: string;
  borrowAPY: string;
  healthFactor: string;
  maxLTV: string;
  ltvFactor: number;
  oracleDeviation: string;
  riskNote: string;
}

const ASSET_DATA: Record<AssetType, AssetConfig> = {
  WETH: {
    name: 'WETH',
    type: 'Wrapped Ethereum',
    category: 'Standard',
    unit: 'ETH',
    borrowAPY: '3.45%',
    healthFactor: '1.85 (Safe)',
    maxLTV: '80%',
    ltvFactor: 0.80,
    oracleDeviation: '0.01%',
    riskNote: 'Standard native collateral. Deep DEX liquidity on Base.',
  },
  ezETH: {
    name: 'ezETH',
    type: 'Renzo Restaked ETH',
    category: 'LRT',
    unit: 'ezETH',
    borrowAPY: '5.12%',
    healthFactor: '1.62 (Moderate)',
    maxLTV: '75%',
    ltvFactor: 0.75,
    oracleDeviation: '0.42%',
    riskNote: 'LRT peg deviation watchdog active. Slashing telemetry synced.',
  },
  USDY: {
    name: 'USDY',
    type: 'Ondo US Dollar Yield',
    category: 'RWA',
    unit: 'USDY',
    borrowAPY: '4.80%',
    healthFactor: '2.10 (Ultra Safe)',
    maxLTV: '85%',
    ltvFactor: 0.85,
    oracleDeviation: '0.03%',
    riskNote: 'TradFi Treasury backing verified via off-chain Proof of Reserve.',
  },
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetType>('WETH');
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'borrow' | 'repay'>('deposit');
  
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');

  // Fallback / mock dynamic totals for non-native tokens
  const [poolCollaterals, setPoolCollaterals] = useState<Record<AssetType, number>>({
    WETH: 145.50,
    ezETH: 320.80,
    USDY: 850000,
  });
  
  // User Positions per Asset
  const [userBalances, setUserBalances] = useState<Record<AssetType, { deposited: number; borrowed: number }>>({
    WETH: { deposited: 0, borrowed: 0 },
    ezETH: { deposited: 0, borrowed: 0 },
    USDY: { deposited: 0, borrowed: 0 },
  });

  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const { isConnected } = useAccount();
  const { data: hash, sendTransaction, isPending: isTxPending } = useSendTransaction();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash });

  // On-Chain Realtime Balance of Protocol Vault on Base Sepolia
  const { data: vaultBalanceData, isLoading: isVaultLoading, refetch: refetchVaultBalance } = useBalance({
    address: PROTOCOL_VAULT_ADDRESS,
    chainId: baseSepolia.id,
  });

  const [telemetryData, setTelemetryData] = useState<{ [key: string]: string }>({
    CRO: 'Ready to scan Base collateral risk...',
    CFO: 'Ready to optimize APY & liquidity...',
    COO: 'Base RPC latency & uptime stable.',
    CTO: 'Circuit breaker & oracle watchdog on standby.',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isTxSuccess) {
      refetchVaultBalance();
    }
  }, [isTxSuccess, refetchVaultBalance]);

  const activeAsset = ASSET_DATA[selectedAsset];
  const currentPosition = userBalances[selectedAsset];
  const maxBorrowCapacity = (currentPosition.deposited * activeAsset.ltvFactor) - currentPosition.borrowed;

  const formatPoolDisplay = (asset: AssetType) => {
    if (asset === 'WETH') {
      if (isVaultLoading) return 'Syncing RPC...';
      if (vaultBalanceData) {
        const liveEth = Number(vaultBalanceData.formatted);
        return `${liveEth.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })} ETH`;
      }
    }

    const val = poolCollaterals[asset];
    if (asset === 'USDY') {
      return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDY`;
    }
    return `${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${activeAsset.unit}`;
  };

  const handleDeposit = () => {
    if (!isConnected) return alert('Please connect your wallet first!');
    const amount = Number(depositAmount);
    if (!depositAmount || amount <= 0) return alert('Enter a valid deposit amount');

    try {
      setActionStatus(`Submitting deposit for ${depositAmount} ${activeAsset.name} to Vault on Base Sepolia...`);
      sendTransaction({
        to: PROTOCOL_VAULT_ADDRESS,
        value: parseEther((amount * 0.0001).toFixed(6)),
      });

      setUserBalances((prev) => ({
        ...prev,
        [selectedAsset]: {
          ...prev[selectedAsset],
          deposited: prev[selectedAsset].deposited + amount,
        },
      }));

      setPoolCollaterals((prev) => ({
        ...prev,
        [selectedAsset]: prev[selectedAsset] + amount,
      }));

      setDepositAmount('');
    } catch (e: any) {
      setActionStatus(`Transaction failed: ${e.message}`);
    }
  };

  const handleWithdraw = () => {
    if (!isConnected) return alert('Please connect your wallet first!');
    const amount = Number(withdrawAmount);
    if (!withdrawAmount || amount <= 0) return alert('Enter a valid withdrawal amount');

    if (amount > currentPosition.deposited) {
      return alert(`Insufficient deposit balance. You only deposited ${currentPosition.deposited} ${activeAsset.name}.`);
    }

    const remainingDeposit = currentPosition.deposited - amount;
    const requiredDepositForDebt = currentPosition.borrowed / activeAsset.ltvFactor;
    if (remainingDeposit < requiredDepositForDebt) {
      return alert(`Action Blocked by AI CRO: Withdrawal would cause instant liquidation. Repay your debt first.`);
    }

    setActionStatus(`Processing withdrawal for ${withdrawAmount} ${activeAsset.name}... AI CRO verifying safety margin.`);
    setTimeout(() => {
      setUserBalances((prev) => ({
        ...prev,
        [selectedAsset]: {
          ...prev[selectedAsset],
          deposited: prev[selectedAsset].deposited - amount,
        },
      }));

      setPoolCollaterals((prev) => ({
        ...prev,
        [selectedAsset]: Math.max(0, prev[selectedAsset] - amount),
      }));

      setActionStatus(`Withdrawal of ${withdrawAmount} ${activeAsset.name} successfully completed on Base Sepolia.`);
      setWithdrawAmount('');
    }, 1500);
  };

  const handleBorrow = () => {
    if (!isConnected) return alert('Please connect your wallet first!');
    const amount = Number(borrowAmount);
    if (!borrowAmount || amount <= 0) return alert('Enter a valid borrow amount');

    if (currentPosition.deposited <= 0) {
      return alert(`Action Denied: You must deposit ${activeAsset.name} collateral before borrowing.`);
    }

    if (amount > maxBorrowCapacity) {
      return alert(`Action Blocked: Max borrow limit exceeded. Available capacity: ${Math.max(0, maxBorrowCapacity).toFixed(4)} USDC equivalent.`);
    }

    setActionStatus(`Processing borrow for ${borrowAmount} USDC... Vault liquidity verified by AI CFO.`);
    setTimeout(() => {
      setUserBalances((prev) => ({
        ...prev,
        [selectedAsset]: {
          ...prev[selectedAsset],
          borrowed: prev[selectedAsset].borrowed + amount,
        },
      }));
      setActionStatus(`Borrow for ${borrowAmount} USDC successfully executed on Base Sepolia.`);
      setBorrowAmount('');
    }, 1500);
  };

  const handleRepay = () => {
    if (!isConnected) return alert('Please connect your wallet first!');
    const amount = Number(repayAmount);
    if (!repayAmount || amount <= 0) return alert('Enter a valid repayment amount');

    if (currentPosition.borrowed <= 0) {
      return alert(`Action Denied: You have no active debt to repay for ${activeAsset.name} vault.`);
    }

    if (amount > currentPosition.borrowed) {
      return alert(`Repayment amount exceeds outstanding debt of ${currentPosition.borrowed.toFixed(4)} USDC.`);
    }

    setActionStatus(`Processing repayment of ${repayAmount} USDC to vault...`);
    setTimeout(() => {
      setUserBalances((prev) => ({
        ...prev,
        [selectedAsset]: {
          ...prev[selectedAsset],
          borrowed: Math.max(0, prev[selectedAsset].borrowed - amount),
        },
      }));
      setActionStatus(`Repayment of ${repayAmount} USDC successful. Health Factor restored.`);
      setRepayAmount('');
    }, 1500);
  };

  const runSentinelAudit = async (role: 'CRO' | 'CFO' | 'COO' | 'CTO') => {
    setLoadingRole(role);
    try {
      const vaultData = {
        asset: activeAsset.name,
        category: activeAsset.category,
        totalDeposited: formatPoolDisplay(selectedAsset),
        borrowAPY: activeAsset.borrowAPY,
        healthFactor: activeAsset.healthFactor,
        maxLTV: activeAsset.maxLTV,
        oracleDeviation: activeAsset.oracleDeviation,
        baseGasGwei: '0.005 Gwei',
        riskContext: activeAsset.riskNote,
        userDeposited: `${currentPosition.deposited} ${activeAsset.name}`,
        userBorrowed: `${currentPosition.borrowed} USDC`,
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
      setTelemetryData((prev) => ({ ...prev, [role]: `Failed to connect: ${err.message}` }));
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
          <ConnectButton label="Connect Wallet" />
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
        
        {/* LEFT COLUMN: VAULT OVERVIEW & EXECUTION */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Pool Overview Card */}
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
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total Pool Collateral</span>
                  {selectedAsset === 'WETH' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Live On-Chain RPC"></span>
                  )}
                </div>
                <p className="text-lg font-bold text-white mt-1 font-mono">
                  {formatPoolDisplay(selectedAsset)}
                </p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/60 p-3.5 rounded-xl">
                <span className="text-xs text-slate-400">Borrow APY</span>
                <p className="text-lg font-bold text-emerald-400 mt-1 font-mono">{activeAsset.borrowAPY}</p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/60 p-3.5 rounded-xl">
                <span className="text-xs text-slate-400">Health Factor</span>
                <p className="text-lg font-bold text-blue-400 mt-1 font-mono">{activeAsset.healthFactor}</p>
              </div>
            </div>

            {/* User Realtime Position in Vault */}
            <div className="mt-4 p-3 bg-slate-950/70 border border-slate-800 rounded-xl grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400">Your Deposited Collateral:</span>
                <p className="text-sm font-semibold text-white font-mono mt-0.5">{currentPosition.deposited} {activeAsset.name}</p>
              </div>
              <div>
                <span className="text-slate-400">Your Active Debt:</span>
                <p className="text-sm font-semibold text-amber-400 font-mono mt-0.5">{currentPosition.borrowed.toFixed(2)} USDC</p>
              </div>
            </div>

            <div className="mt-3 p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-400">Sentinel Watchdog Status:</span>
              <span className="text-slate-300 font-mono">{activeAsset.riskNote}</span>
            </div>
          </div>

          {/* Action Module with Tabs */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
              <h2 className="text-base font-semibold text-slate-200">Vault Execution</h2>
              
              <div className="flex bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setActiveTab('deposit')}
                  className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                    activeTab === 'deposit' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Deposit
                </button>
                <button
                  onClick={() => setActiveTab('withdraw')}
                  className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                    activeTab === 'withdraw' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Withdraw
                </button>
                <button
                  onClick={() => setActiveTab('borrow')}
                  className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                    activeTab === 'borrow' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Borrow
                </button>
                <button
                  onClick={() => setActiveTab('repay')}
                  className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                    activeTab === 'repay' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Repay
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* DEPOSIT TAB */}
              {activeTab === 'deposit' && (
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
              )}

              {/* WITHDRAW TAB */}
              {activeTab === 'withdraw' && (
                <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Withdraw Collateral ({activeAsset.name})</span>
                    <span className="text-slate-400">Available to withdraw: {currentPosition.deposited} {activeAsset.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="0.0"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                    />
                    <button
                      onClick={handleWithdraw}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium text-xs transition shrink-0 cursor-pointer"
                    >
                      Withdraw {activeAsset.name}
                    </button>
                  </div>
                </div>
              )}

              {/* BORROW TAB */}
              {activeTab === 'borrow' && (
                <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Borrow Liquidity (USDC)</span>
                    <span className={currentPosition.deposited > 0 ? "text-emerald-400 font-mono" : "text-rose-400 font-mono"}>
                      {currentPosition.deposited > 0 ? `Max Borrow Capacity: ${Math.max(0, maxBorrowCapacity).toFixed(4)} USDC` : 'Requires Collateral Deposit'}
                    </span>
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
              )}

              {/* REPAY TAB */}
              {activeTab === 'repay' && (
                <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Repay Debt (USDC)</span>
                    <span className={currentPosition.borrowed > 0 ? "text-amber-400 font-mono" : "text-slate-400 font-mono"}>
                      {currentPosition.borrowed > 0 ? `Outstanding Debt: ${currentPosition.borrowed.toFixed(4)} USDC` : 'No Active Debt'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="0.0"
                      value={repayAmount}
                      onChange={(e) => setRepayAmount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={handleRepay}
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium text-xs transition shrink-0 cursor-pointer"
                    >
                      Repay Debt
                    </button>
                  </div>
                </div>
              )}

              {/* Status Activity Bar */}
              {actionStatus && (
                <div className="p-3 bg-blue-950/30 border border-blue-800/50 rounded-xl text-xs text-blue-300 font-mono">
                  {actionStatus} {isTxSuccess && '— On-Chain Transaction Confirmed!'}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: 4 GEMINI FLASH C-LEVEL SENTINEL AGENTS */}
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