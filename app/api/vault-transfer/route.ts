import { NextResponse } from 'next/server';
import { createWalletClient, http, parseEther, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

export async function POST(req: Request) {
  try {
    const { userAddress, amount, actionType } = await req.json();

    if (!userAddress || !amount || Number(amount) <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid address or amount' }, { status: 400 });
    }

    const rawKey = process.env.VAULT_PRIVATE_KEY;
    if (!rawKey) {
      return NextResponse.json({ success: false, error: 'Vault private key not configured' }, { status: 500 });
    }

    const formattedKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);

    const client = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http('https://sepolia.base.org'),
    });

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http('https://sepolia.base.org'),
    });

    // Kirim ETH testnet proporsional sesuai nominal demo (misal: 0.0001 ETH per 1 unit)
    const ethValueToSend = parseEther((Number(amount) * 0.0001).toFixed(6));

    const txHash = await client.sendTransaction({
      to: userAddress as `0x${string}`,
      value: ethValueToSend,
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return NextResponse.json({
      success: true,
      txHash,
      message: `${actionType === 'borrow' ? 'Borrow payout' : 'Withdrawal'} dispatched successfully on Base Sepolia!`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}