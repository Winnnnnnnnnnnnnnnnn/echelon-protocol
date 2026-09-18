import { NextResponse } from 'next/server';
import { createWalletClient, http, parseEther, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Helper async pengiriman notifikasi ke Telegram Bot
async function sendTelegramAlert(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[Echelon Sentinel] Telegram credentials missing. Alert skipped.');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.error('[Echelon Sentinel] Error sending Telegram alert:', error);
  }
}

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

    // Kirim ETH testnet proporsional sesuai nominal demo (0.0001 ETH per unit)
    const ethValueToSend = parseEther((Number(amount) * 0.0001).toFixed(6));

    const txHash = await client.sendTransaction({
      to: userAddress as `0x${string}`,
      value: ethValueToSend,
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Format notifikasi settlement on-chain
    const explorerUrl = `https://sepolia.basescan.org/tx/${txHash}`;
    const alertMessage = 
`⚡ <b>[ECHELON SENTINEL] Vault Settlement Event</b>

• <b>Type:</b> ${actionType === 'borrow' ? 'Borrow Payout' : 'Collateral Withdrawal'}
• <b>Amount:</b> ${amount} Units (~${(Number(amount) * 0.0001).toFixed(6)} ETH)
• <b>Recipient:</b> <code>${userAddress.slice(0, 6)}...${userAddress.slice(-4)}</code>
• <b>Network:</b> Base Sepolia
• <b>Explorer:</b> <a href="${explorerUrl}">Basescan Tx Link</a>

<i>Status: On-chain confirmed & telemetry healthy</i>`;

    // Panggil helper tanpa await agar tidak memperpanjang latensi API
    sendTelegramAlert(alertMessage);

    return NextResponse.json({
      success: true,
      txHash,
      message: `${actionType === 'borrow' ? 'Borrow payout' : 'Withdrawal'} dispatched successfully on Base Sepolia!`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}