import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // 認証は middleware（セッションCookie）が保証。
  const { prompt } = await req.json().catch(() => ({ prompt: '' }));

  if (typeof prompt !== 'string' || prompt.length === 0) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }
  if (prompt.length > 8000) {
    return NextResponse.json({ error: 'prompt が長すぎます（8000文字以内）' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY が設定されていません。' }, { status: 500 });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const summary = data.content?.[0]?.text || '要約を取得できませんでした。';
    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ summary: 'APIエラーが発生しました。' }, { status: 500 });
  }
}
