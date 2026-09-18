import { NextResponse } from 'next/server';
import { createWalletClient, http, parseEther, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Helper async untuk pengiriman notifikasi ke Telegram Bot
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
    const { userAddress, amount, actionType, assetName } = await req.json();

    if (!userAddress || !amount || Number(amount) <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid address or amount' }, { status: 400 });
    }

    const targetAsset = assetName || 'WETH';
    const actionLabel = {
      deposit: 'Collateral Deposit',
      withdraw: 'Collateral Withdrawal',
      borrow: 'Borrow Payout',
      repay: 'Debt Repayment',
    }[actionType as string] || 'Vault Action';

    // Aksi yang membutuhkan payout on-chain dari relayer vault
    if (actionType === 'withdraw' || actionType === 'borrow') {
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

      // 0.0001 ETH per 1 unit demo
      const ethValueToSend = parseEther((Number(amount) * 0.0001).toFixed(6));

      const txHash = await client.sendTransaction({
        to: userAddress as `0x${string}`,
        value: ethValueToSend,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      const explorerUrl = `https://sepolia.basescan.org/tx/${txHash}`;
      const alertMessage =
`⚡ <b>[ECHELON SENTINEL] Vault Settlement Event</b>

• <b>Action:</b> ${actionLabel}
• <b>Asset:</b> ${targetAsset}
• <b>Amount:</b> ${amount} (~${(Number(amount) * 0.0001).toFixed(6)} ETH)
• <b>User:</b> <code>${userAddress.slice(0, 6)}...${userAddress.slice(-4)}</code>
• <b>Network:</b> Base Sepolia
• <b>Explorer:</b> <a href="${explorerUrl}">Basescan Link</a>

<i>Status: Dispatched & Confirmed on-chain</i>`;

      sendTelegramAlert(alertMessage);

      return NextResponse.json({
        success: true,
        txHash,
        message: `${actionLabel} successful and dispatched on Base Sepolia!`,
      });
    }

    // Untuk Deposit & Repay (Inbound event)
    const alertMessage =
`📥 <b>[ECHELON SENTINEL] Vault Position Update</b>

• <b>Action:</b> ${actionLabel}
• <b>Asset:</b> ${targetAsset}
• <b>Amount:</b> ${amount} Units
• <b>User:</b> <code>${userAddress.slice(0, 6)}...${userAddress.slice(-4)}</code>
• <b>Network:</b> Base Sepolia

<i>Status: Position successfully adjusted</i>`;

    sendTelegramAlert(alertMessage);

    return NextResponse.json({
      success: true,
      message: `${actionLabel} processed successfully!`,
    });
  } catch (error: any) {
    console.error('[Echelon Vault API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}