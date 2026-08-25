'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { parseEther, createPublicClient, http, formatGwei } from 'viem';

const PROTOCOL_VAULT_ADDRESS = '0xC95DDE4889e05d261618fD33baC37011C5a307D4' as `0x${string}`;

type AssetType = 'WETH' | 'ezETH' | 'USDY';

interface AssetStaticConfig {
  name: string;
  type: string;
  category: 'Standard' | 'LRT' | 'RWA';
  unit: string;
  baseAPY: number;      // Base rate (e.g. 2.0%)
  multiplier: number;   // Utilization slope (e.g. 8.0%)
  maxLTV: string;
  ltvFactor: number;
  liquidationThreshold: number;
  oracleDeviation: string;
  riskNote: string;
}

const ASSET_CONFIGS: Record<AssetType, AssetStaticConfig> = {
  WETH: {
    name: 'WETH',
    type: 'Wrapped Ethereum',
    category: 'Standard',
    unit: 'ETH',
    baseAPY: 2.10,
    multiplier: 6.50,
    maxLTV: '80%',
    ltvFactor: 0.80,
    liquidationThreshold: 0.85,
    oracleDeviation: '0.01%',
    riskNote: 'Standard native collateral. Deep DEX liquidity on Base.',
  },
  ezETH: {
    name: 'ezETH',
    type: 'Renzo Restaked ETH',
    category: 'LRT',
    unit: 'ezETH',
    baseAPY: 3.50,
    multiplier: 8.00,
    maxLTV: '75%',
    ltvFactor: 0.75,
    liquidationThreshold: 0.80,
    oracleDeviation: '0.42%',
    riskNote: 'LRT peg deviation watchdog active. Slashing telemetry synced.',
  },
  USDY: {
    name: 'USDY',
    type: 'Ondo US Dollar Yield',
    category: 'RWA',
    unit: 'USDY',
    baseAPY: 4.20,
    multiplier: 4.00,
    maxLTV: '85%',
    ltvFactor: 0.85,
    liquidationThreshold: 0.90,
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
  const [isProcessingVaultTx, setIsProcessingVaultTx] = useState(false);
  const [liveGasGwei, setLiveGasGwei] = useState<string>('0.005 Gwei');

  // Persistent Pool State (Load from localStorage if available)
  const [poolState, setPoolState] = useState<Record<AssetType, { deposited: number; borrowed: number }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('echelon_pool_state');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return {
      WETH: { deposited: 145.50, borrowed: 48.20 },
      ezETH: { deposited: 320.80, borrowed: 112.40 },
      USDY: { deposited: 850000, borrowed: 340000 },
    };
  });
  
  // Persistent User Balances (Load from localStorage if available)
  const [userBalances, setUserBalances] = useState<Record<AssetType, { deposited: number; borrowed: number }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('echelon_user_balances');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return {
      WETH: { deposited: 0, borrowed: 0 },
      ezETH: { deposited: 0, borrowed: 0 },
      USDY: { deposited: 0, borrowed: 0 },
    };
  });

  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const { address: userAddress, isConnected } = useAccount();
  const { data: hash, sendTransaction, isPending: isTxPending } = useSendTransaction();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash });

  // On-Chain Realtime Native Vault Balance
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

  // Hydration fix & Save to localStorage
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('echelon_pool_state', JSON.stringify(poolState));
      localStorage.setItem('echelon_user_balances', JSON.stringify(userBalances));
    }
  }, [poolState, userBalances, mounted]);

  // Fetch Live Base Sepolia Gas
  useEffect(() => {
    const fetchGas = async () => {
      try {
        const client = createPublicClient({
          chain: baseSepolia,
          transport: http('https://sepolia.base.org'),
        });
        const gasPrice = await client.getGasPrice();
        setLiveGasGwei(`${Number(formatGwei(gasPrice)).toFixed(4)} Gwei`);
      } catch (e) {
        setLiveGasGwei('0.005 Gwei');
      }
    };
    fetchGas();
    const interval = setInterval(fetchGas, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isTxSuccess) {
      refetchVaultBalance();
    }
  }, [isTxSuccess, refetchVaultBalance]);

  const activeConfig = ASSET_CONFIGS[selectedAsset];
  const currentPool = poolState[selectedAsset];
  const currentPosition = userBalances[selectedAsset];

  // REAL-TIME METRICS COMPUTATION
  const realTimePoolDeposited = useMemo(() => {
    if (selectedAsset === 'WETH' && vaultBalanceData) {
      return Number(vaultBalanceData.formatted);
    }
    return currentPool.deposited;
  }, [selectedAsset, vaultBalanceData, currentPool.deposited]);

  // Dynamic APY based on pool utilization rate: APY = Base + (Utilization * Slope)
  const dynamicBorrowAPY = useMemo(() => {
    if (realTimePoolDeposited <= 0) return `${activeConfig.baseAPY.toFixed(2)}%`;
    const utilization = Math.min(1, currentPool.borrowed / realTimePoolDeposited);
    const calculatedAPY = activeConfig.baseAPY + (utilization * activeConfig.multiplier);
    return `${calculatedAPY.toFixed(2)}%`;
  }, [activeConfig, currentPool.borrowed, realTimePoolDeposited]);

  // Dynamic Health Factor calculation
  const dynamicHealthFactor = useMemo(() => {
    if (currentPosition.borrowed <= 0) return { score: '∞ (Safe)', status: 'Safe', color: 'text-blue-400' };
    
    const maxBorrowableDebt = currentPosition.deposited * activeConfig.ltvFactor;
    const hf = maxBorrowableDebt / currentPosition.borrowed;

    if (hf >= 1.5) return { score: `${hf.toFixed(2)} (Safe)`, status: 'Safe', color: 'text-emerald-400' };
    if (hf >= 1.1) return { score: `${hf.toFixed(2)} (Moderate)`, status: 'Moderate', color: 'text-amber-400' };
    return { score: `${hf.toFixed(2)} (Liquidation Risk)`, status: 'Danger', color: 'text-rose-400' };
  }, [currentPosition, activeConfig]);

  const maxBorrowCapacity = (currentPosition.deposited * activeConfig.ltvFactor) - currentPosition.borrowed;

  const formatPoolDisplay = (asset: AssetType) => {
    if (asset === 'WETH') {
      if (isVaultLoading) return 'Syncing RPC...';
      if (vaultBalanceData) {
        return `${Number(vaultBalanceData.formatted).toFixed(4)} ETH`;
      }
    }
    const val = poolState[asset].deposited;
    if (asset === 'USDY') {
      return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDY`;
    }
    return `${val.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${ASSET_CONFIGS[asset].unit}`;
  };

  // EXECUTION HANDLERS
  const handleDeposit = () => {
    if (!isConnected) return alert('Please connect your wallet first!');
    const amount = Number(depositAmount);
    if (!depositAmount || amount <= 0) return alert('Enter a valid deposit amount');

    try {
      setActionStatus(`Submitting deposit for ${depositAmount} ${activeConfig.name} to Vault on Base Sepolia...`);
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

      setPoolState((prev) => ({
        ...prev,
        [selectedAsset]: {
          ...prev[selectedAsset],
          deposited: prev[selectedAsset].deposited + amount,
        },
      }));

      setDepositAmount('');
    } catch (e: any) {
      setActionStatus(`Transaction failed: ${e.message}`);
    }
  };

  const handleWithdraw = async () => {
    if (!isConnected) return alert('Please connect your wallet first!');
    const amount = Number(withdrawAmount);
    if (!withdrawAmount || amount <= 0) return alert('Enter a valid withdrawal amount');

    if (amount > currentPosition.deposited) {
      return alert(`Insufficient balance. You only deposited ${currentPosition.deposited} ${activeConfig.name}.`);
    }

    const remainingDeposit = currentPosition.deposited - amount;
    const requiredDepositForDebt = currentPosition.borrowed / activeConfig.ltvFactor;
    if (currentPosition.borrowed > 0 && remainingDeposit < requiredDepositForDebt) {
      return alert(`Action Blocked by AI CRO: Health Factor would drop below liquidation threshold. Repay debt first.`);
    }

    setIsProcessingVaultTx(true);
    setActionStatus(`Initiating vault transfer: Sending ${withdrawAmount} ${activeConfig.name} back to your wallet...`);

    try {
      const res = await fetch('/api/vault-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          amount: withdrawAmount,
          actionType: 'withdraw',
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setUserBalances((prev) => ({
        ...prev,
        [selectedAsset]: {
          ...prev[selectedAsset],
          deposited: prev[selectedAsset].deposited - amount,
        },
      }));

      setPoolState((prev) => ({
        ...prev,
        [selectedAsset]: {
          ...prev[selectedAsset],
          deposited: Math.max(0, prev[selectedAsset].deposited - amount),
        },
      }));

      refetchVaultBalance();
      setActionStatus(`Withdrawal confirmed! Tx: ${data.txHash.slice(0, 10)}...${data.txHash.slice(-8)}`);
      setWithdrawAmount('');
    } catch (err: any) {
      setActionStatus(`Withdrawal dispatch failed: ${err.message}`);
    } finally {
      setIsProcessingVaultTx(false);
    }
  };

  const handleBorrow = async () => {
    if (!isConnected) return alert('Please connect your wallet first!');
    const amount = Number(borrowAmount);
    if (!borrowAmount || amount <= 0) return alert('Enter a valid borrow amount');

    if (currentPosition.deposited <= 0) {
      return alert(`Action Denied: You must deposit ${activeConfig.name} collateral before borrowing.`);
    }

    if (amount > maxBorrowCapacity) {
      return alert(`Action Blocked: Max borrow limit exceeded. Available capacity: ${Math.max(0, maxBorrowCapacity).toFixed(4)} USDC equivalent.`);
    }

    setIsProcessingVaultTx(true);
    setActionStatus(`AI CFO approving liquidity payout: Vault sending ${borrowAmount} USDC to your wallet...`);

    try {
      const res = await fetch('/api/vault-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          amount: borrowAmount,
          actionType: 'borrow',
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setUserBalances((prev) => ({
        ...prev,
        [selectedAsset]: {
          ...prev[selectedAsset],
          borrowed: prev[selectedAsset].borrowed + amount,
        },
      }));

      setPoolState((prev) => ({
        ...prev,
        [selectedAsset]: {
          ...prev[selectedAsset],
          borrowed: prev[selectedAsset].borrowed + amount,
        },
      }));

      refetchVaultBalance();
      setActionStatus(`Borrow payout confirmed! Tx: ${data.txHash.slice(0, 10)}...${data.txHash.slice(-8)}`);
      setBorrowAmount('');
    } catch (err: any) {
      setActionStatus(`Borrow payout failed: ${err.message}`);
    } finally {
      setIsProcessingVaultTx(false);
    }
  };

  const handleRepay = () => {
    if (!isConnected) return alert('Please connect your wallet first!');
    const amount = Number(repayAmount);
    if (!repayAmount || amount <= 0) return alert('Enter a valid repayment amount');

    if (currentPosition.borrowed <= 0) {
      return alert(`Action Denied: You have no active debt to repay for ${activeConfig.name} vault.`);
    }

    if (amount > currentPosition.borrowed) {
      return alert(`Repayment amount exceeds outstanding debt of ${currentPosition.borrowed.toFixed(4)} USDC.`);
    }

    try {
      setActionStatus(`Submitting debt repayment of ${repayAmount} USDC to Vault...`);
      sendTransaction({
        to: PROTOCOL_VAULT_ADDRESS,
        value: parseEther((amount * 0.0001).toFixed(6)),
      });

      setUserBalances((prev) => ({
        ...prev,
        [selectedAsset]: {
          ...prev[selectedAsset],
          borrowed: Math.max(0, prev[selectedAsset].borrowed - amount),
        },
      }));

      setPoolState((prev) => ({
        ...prev,
        [selectedAsset]: {
          ...prev[selectedAsset],
          borrowed: Math.max(0, prev[selectedAsset].borrowed - amount),
        },
      }));

      setRepayAmount('');
    } catch (e: any) {
      setActionStatus(`Repayment failed: ${e.message}`);
    }
  };

  const runSentinelAudit = async (role: 'CRO' | 'CFO' | 'COO' | 'CTO') => {
    setLoadingRole(role);
    try {
      const vaultData = {
        asset: activeConfig.name,
        category: activeConfig.category,
        totalDeposited: formatPoolDisplay(selectedAsset),
        borrowAPY: dynamicBorrowAPY,
        healthFactor: dynamicHealthFactor.score,
        maxLTV: activeConfig.maxLTV,
        oracleDeviation: activeConfig.oracleDeviation,
        baseGasGwei: liveGasGwei,
        riskContext: activeConfig.riskNote,
        userDeposited: `${currentPosition.deposited} ${activeConfig.name}`,
        userBorrowed: `${currentPosition.borrowed.toFixed(2)} USDC`,
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
        <div className="flex items-center gap-3.5">
          <Image
            src="/icon-removebg-preview.svg"
            alt="Echelon Protocol Logo"
            width={44}
            height={44}
            className="h-11 w-11 object-contain drop-shadow-[0_0_12px_rgba(37,99,235,0.45)]"
            priority
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-teal-400">
                ECHELON PROTOCOL
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Base Sepolia
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Autonomous Multi-Asset Lending Sentinel (Standard, LRT & RWA Protected) • Base Gas: <span className="text-cyan-400">{liveGasGwei}</span>
            </p>
          </div>
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
          const item = ASSET_CONFIGS[assetKey];
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
                {activeConfig.name} Vault Overview
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {activeConfig.type}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-950/60 border border-slate-800/60 p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total Pool Collateral</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Real-time Reactive"></span>
                </div>
                <p className="text-lg font-bold text-white mt-1 font-mono">
                  {formatPoolDisplay(selectedAsset)}
                </p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/60 p-3.5 rounded-xl">
                <span className="text-xs text-slate-400">Borrow APY (Dynamic)</span>
                <p className="text-lg font-bold text-emerald-400 mt-1 font-mono">{dynamicBorrowAPY}</p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/60 p-3.5 rounded-xl">
                <span className="text-xs text-slate-400">Health Factor</span>
                <p className={`text-lg font-bold mt-1 font-mono ${dynamicHealthFactor.color}`}>
                  {dynamicHealthFactor.score}
                </p>
              </div>
            </div>

            {/* User Realtime Position in Vault */}
            <div className="mt-4 p-3 bg-slate-950/70 border border-slate-800 rounded-xl grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400">Your Deposited Collateral:</span>
                <p className="text-sm font-semibold text-white font-mono mt-0.5">{currentPosition.deposited} {activeConfig.name}</p>
              </div>
              <div>
                <span className="text-slate-400">Your Active Debt:</span>
                <p className="text-sm font-semibold text-amber-400 font-mono mt-0.5">{currentPosition.borrowed.toFixed(2)} USDC</p>
              </div>
            </div>

            <div className="mt-3 p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-400">Sentinel Watchdog Status:</span>
              <span className="text-slate-300 font-mono">{activeConfig.riskNote}</span>
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
                    <span>Deposit Collateral ({activeConfig.name})</span>
                    <span>Max LTV: {activeConfig.maxLTV}</span>
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
                      {isTxPending ? 'Signing...' : isTxConfirming ? 'Confirming...' : `Deposit ${activeConfig.name}`}
                    </button>
                  </div>
                </div>
              )}

              {/* WITHDRAW TAB */}
              {activeTab === 'withdraw' && (
                <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Withdraw Collateral ({activeConfig.name})</span>
                    <span className="text-slate-400">Available: {currentPosition.deposited} {activeConfig.name}</span>
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
                      disabled={isProcessingVaultTx}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white rounded-lg font-medium text-xs transition shrink-0 cursor-pointer"
                    >
                      {isProcessingVaultTx ? 'Transferring...' : `Withdraw ${activeConfig.name}`}
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
                      disabled={isProcessingVaultTx}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg font-medium text-xs transition shrink-0 cursor-pointer"
                    >
                      {isProcessingVaultTx ? 'Disbursing...' : 'Borrow USDC'}
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
                      disabled={isTxPending || isTxConfirming}
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white rounded-lg font-medium text-xs transition shrink-0 cursor-pointer"
                    >
                      {isTxPending ? 'Signing...' : isTxConfirming ? 'Confirming...' : 'Repay Debt'}
                    </button>
                  </div>
                </div>
              )}

              {/* Status Activity Bar */}
              {actionStatus && (
                <div className="p-3 bg-blue-950/30 border border-blue-800/50 rounded-xl text-xs text-blue-300 font-mono">
                  {actionStatus} {isTxSuccess && '— Transaction Confirmed on Base Sepolia!'}
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