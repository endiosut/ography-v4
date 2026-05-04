import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const OGRAPHY_SERVICES = [
  'Brand Identity Kit ($1,499 · 5–7 days)',
  'Logo & Visual Identity ($899 · 5–7 days)',
  'Social Media Pack ($499 · 3–5 days)',
  'Print & Production ($799 · 7–10 days)',
  'Brand Strategy ($1,199 · 5–7 days)',
  'Event Media Coverage ($699 · 2–3 days)',
];

const STYLE_KEYWORDS = [
  'Minimal', 'Bold', 'Elegant', 'Modern', 'Classic', 'Playful',
  'Luxury', 'Editorial', 'Geometric', 'Organic', 'Technical', 'Artisanal',
  'Dark & Moody', 'Clean & Bright', 'Vintage', 'Futuristic',
];

export async function POST(req: NextRequest) {
  try {
    const { mode, input, projectContext } = await req.json();

    if (!mode || !input) {
      return NextResponse.json({ error: 'Missing mode or input' }, { status: 400 });
    }

    let systemPrompt = '';
    let userMessage = '';

    if (mode === 'brief_generator') {
      systemPrompt = `You are OGraphy's AI creative director. OGraphy is a luxury managed visual identity studio.

Available services: ${OGRAPHY_SERVICES.join(', ')}.
Available style keywords: ${STYLE_KEYWORDS.join(', ')}.

When given a business concept, respond ONLY with valid JSON (no markdown, no explanation) in this exact format:
{
  "summary": "2-sentence brand concept summary",
  "recommendedServices": ["service1", "service2"],
  "styleKeywords": ["keyword1", "keyword2", "keyword3"],
  "colorPalette": [
    {"name": "Primary", "hex": "#XXXXXX", "description": "warm description"},
    {"name": "Secondary", "hex": "#XXXXXX", "description": "warm description"},
    {"name": "Accent", "hex": "#XXXXXX", "description": "warm description"}
  ],
  "briefSuggestions": {
    "businessName": "suggested name or empty string",
    "industry": "most relevant industry category",
    "description": "2-3 sentence project description"
  }
}`;
      userMessage = input;
    } else if (mode === 'style_explorer') {
      systemPrompt = `You are OGraphy's AI creative director. Given a set of style keywords, generate a rich aesthetic mood description. Respond ONLY with valid JSON (no markdown):
{
  "moodTitle": "evocative 3-4 word title",
  "moodDescription": "2 paragraph rich aesthetic description of the visual world these keywords create",
  "typographyDirection": "1-2 sentences on typography approach",
  "photographyDirection": "1-2 sentences on photography/imagery style",
  "brandVoice": "1-2 sentences on brand tone and voice",
  "colorNotes": "1-2 sentences on color direction based on these keywords"
}`;
      userMessage = `Style keywords selected: ${input}`;
    } else if (mode === 'project_assistant') {
      systemPrompt = `You are OGraphy's brand advisor for a client whose project is currently in production. You help them understand how to use their new brand assets effectively. Be specific, practical, and luxuriously concise.

Project context: ${projectContext || 'Brand identity project in production'}.

Keep responses under 150 words. Be direct and actionable.`;
      userMessage = input;
    } else if (mode === 'usage_monitor') {
      systemPrompt = `You are OGraphy's growth advisor. Given a client's project history, recommend what they should commission next to grow their brand. Be specific and persuasive but not pushy. Respond ONLY with valid JSON:
{
  "nextStep": "one clear recommendation",
  "reasoning": "1-2 sentences why",
  "suggestedService": "exact service name from OGraphy catalog",
  "trendingForIndustry": "what brands in their industry are investing in right now"
}

OGraphy services: ${OGRAPHY_SERVICES.join(', ')}.`;
      userMessage = input;
    } else {
      return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';

    // For JSON modes, parse and return structured data
    if (['brief_generator', 'style_explorer', 'usage_monitor'].includes(mode)) {
      try {
        const parsed = JSON.parse(text);
        return NextResponse.json({ result: parsed });
      } catch {
        return NextResponse.json({ result: text });
      }
    }

    return NextResponse.json({ result: text });
  } catch (e: any) {
    console.error('AI route error:', e);
    return NextResponse.json({ error: e.message || 'AI request failed' }, { status: 500 });
  }
}
