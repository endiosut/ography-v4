import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

import { AI_STUDIO_ENABLED } from '@/lib/features';

// Fail closed. The UI no longer links here, but an endpoint that still answers
// is an endpoint that still costs money and still leaks capability.
function aiStudioDisabled() {
  return Response.json(
    { error: 'AI Studio is not available.' },
    { status: 404 }
  );
}


const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  if (!AI_STUDIO_ENABLED) return aiStudioDisabled();
  try {
    const { messages, projectContext } = await req.json();
    if (!messages?.length) return NextResponse.json({ error: 'Messages required' }, { status: 400 });

    const systemPrompt = `You are OGraphy's creative director AI. You give precise, actionable brand guidance. Keep responses under 150 words. Be direct, opinionated, and premium in tone. You help clients with brand decisions, visual direction, and service selection.${projectContext ? `\n\nClient context: ${projectContext}` : ''}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const text = (response.content[0] as any).text;
    return NextResponse.json({ message: text });
  } catch (e: any) {
    console.error('Assistant error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
