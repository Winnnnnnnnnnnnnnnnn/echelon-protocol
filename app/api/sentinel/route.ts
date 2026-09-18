import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const { role, vaultData } = await req.json();
    let telemetry = '';

    // Konfigurasi instruksi per role
    const roleConfig: Record<string, { system: string; prompt: string; temp: number }> = {
      CRO: {
        system: 'You are Echelon AI CRO. Analyze collateral safety & liquidation thresholds on Base. Respond strictly in 2 concise sentences with Risk Level (Low/Medium/High).',
        prompt: `Snapshot: ${JSON.stringify(vaultData || {})}`,
        temp: 0.1,
      },
      CFO: {
        system: 'You are Echelon AI CFO. Calculate dynamic borrow utilization & pool APY. Respond strictly in 2 concise sentences with actionable yield optimization.',
        prompt: `Metrics: ${JSON.stringify(vaultData || {})}`,
        temp: 0.2,
      },
      COO: {
        system: 'You are Echelon AI COO. Monitor Base network gas stability (Gwei), RPC latency, and relayer uptime. Respond strictly in 2 concise sentences confirming operational infrastructure health.',
        prompt: `Telemetry: ${JSON.stringify(vaultData || {})}`,
        temp: 0.1,
      },
      CTO: {
        system: 'You are Echelon AI CTO. Inspect smart contract circuit breakers, oracle price feed deviation, and mempool exploit risks. Respond strictly in 2 concise sentences providing an automated protocol security verdict.',
        prompt: `Security Audit Data: ${JSON.stringify(vaultData || {})}`,
        temp: 0.1,
      },
    };

    const targetConfig = roleConfig[role];
    if (!targetConfig) {
      return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Primary Engine: Groq LPU (openai/gpt-oss-20b)
    if (groqKey) {
      try {
        const groq = new Groq({ apiKey: groqKey });
        const completion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: targetConfig.system },
            { role: 'user', content: targetConfig.prompt },
          ],
          model: 'openai/gpt-oss-20b',
          temperature: targetConfig.temp,
          max_tokens: 250,
        });

        telemetry = completion.choices[0]?.message?.content || `${role} Telemetry OK`;
      } catch (groqErr) {
        console.warn('[Echelon Sentinel] Groq failed, switching to Gemini fallback:', groqErr);
      }
    }

    // 2. Secondary Engine: Gemini Fallback
    if (!telemetry && geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: targetConfig.prompt }] }],
          config: {
            systemInstruction: targetConfig.system,
            temperature: targetConfig.temp,
          },
        });
        telemetry = response.text || `${role} Telemetry OK`;
      } catch (geminiErr) {
        console.error('[Echelon Sentinel] Fallback Gemini failed:', geminiErr);
      }
    }

    if (!telemetry) {
      return NextResponse.json(
        { success: false, error: 'Both Groq and Gemini engines failed to process request.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, role, telemetry });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}