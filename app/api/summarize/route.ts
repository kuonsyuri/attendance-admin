import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ summary: 'ANTHROPIC_API_KEY が設定されていません。.env.local に追加してください。' }, { status: 200 });
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
