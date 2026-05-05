import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are OGraphy's creative brief AI. A client has described their intent: "${prompt}"

Return a JSON object with this exact structure:
{
  "services": ["service1", "service2"],
  "style": ["keyword1", "keyword2", "keyword3"],
  "palette": [
    {"name": "Primary", "hex": "#RRGGBB", "role": "dominant color purpose"},
    {"name": "Accent", "hex": "#RRGGBB", "role": "accent purpose"},
    {"name": "Neutral", "hex": "#RRGGBB", "role": "neutral purpose"}
  ],
  "brief": "2-3 sentence creative brief summary"
}

Services must come from: Brand Identity, UGC Content Kit, Social Media Starter, Event Identity Kit, Pitch Deck Design, Photo Retouch, Print Banner, Event Photography.
Respond ONLY with the JSON object, no markdown.`,
      }],
    });

    const text = (message.content[0] as any).text;
    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch (e: any) {
    console.error('Brief gen error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
