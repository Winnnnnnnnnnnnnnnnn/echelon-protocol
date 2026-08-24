import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const { role, vaultData } = await req.json();
    let telemetry = '';

    const geminiKey = process.env.GEMINI_API_KEY || '';
    if (!geminiKey) {
      return NextResponse.json({ success: false, error: 'GEMINI_API_KEY tidak ditemukan di .env.local' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // 1. AI CRO -> Collateral Risk & Liquidation Sentinel
    if (role === 'CRO') {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [{ role: 'user', parts: [{ text: `Snapshot: ${JSON.stringify(vaultData || {})}` }] }],
        config: {
          systemInstruction: 'You are Echelon AI CRO. Analyze collateral safety & liquidation thresholds on Base. Respond strictly in 2 concise sentences with Risk Level (Low/Medium/High).',
          temperature: 0.1,
        },
      });
      telemetry = response.text || 'CRO Telemetry OK';
    }

    // 2. AI CFO -> Yield, APY & Dynamic Rebalancing Sentinel
    else if (role === 'CFO') {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [{ role: 'user', parts: [{ text: `Metrics: ${JSON.stringify(vaultData || {})}` }] }],
        config: {
          systemInstruction: 'You are Echelon AI CFO. Calculate dynamic borrow utilization & pool APY. Respond strictly in 2 concise sentences with actionable yield optimization.',
          temperature: 0.2,
        },
      });
      telemetry = response.text || 'CFO Telemetry OK';
    }

    // 3. AI COO -> Base Network Gas & RPC Operations Sentinel
    else if (role === 'COO') {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [{ role: 'user', parts: [{ text: `Telemetry: ${JSON.stringify(vaultData || {})}` }] }],
        config: {
          systemInstruction: 'You are Echelon AI COO. Monitor Base network gas stability (Gwei), RPC latency, and relayer uptime. Respond strictly in 2 concise sentences confirming operational infrastructure health.',
          temperature: 0.1,
        },
      });
      telemetry = response.text || 'COO Telemetry OK';
    }

    // 4. AI CTO -> Smart Contract & Circuit Breaker Guard
    else if (role === 'CTO') {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [{ role: 'user', parts: [{ text: `Security Audit Data: ${JSON.stringify(vaultData || {})}` }] }],
        config: {
          systemInstruction: 'You are Echelon AI CTO. Inspect smart contract circuit breakers, oracle price feed deviation, and mempool exploit risks. Respond strictly in 2 concise sentences providing an automated protocol security verdict.',
          temperature: 0.1,
        },
      });
      telemetry = response.text || 'CTO Telemetry OK';
    }

    else {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    return NextResponse.json({ success: true, role, telemetry });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}