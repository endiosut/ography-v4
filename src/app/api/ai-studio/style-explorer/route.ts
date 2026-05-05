import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { keywords } = await req.json();
    if (!keywords?.length) return NextResponse.json({ error: 'Keywords required' }, { status: 400 });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are a luxury brand aesthetic consultant. The client selected these style keywords: ${keywords.join(', ')}.

Return a JSON object:
{
  "description": "2-3 sentence aesthetic direction",
  "palette": [
    {"name": "Name", "hex": "#RRGGBB"},
    {"name": "Name", "hex": "#RRGGBB"},
    {"name": "Name", "hex": "#RRGGBB"},
    {"name": "Name", "hex": "#RRGGBB"},
    {"name": "Name", "hex": "#RRGGBB"}
  ]
}

Make the palette feel premium and intentional. Respond ONLY with the JSON object.`,
      }],
    });

    const text = (message.content[0] as any).text;
    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch (e: any) {
    console.error('Style explorer error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
