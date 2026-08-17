import { NextRequest, NextResponse } from 'next/server';
import { handleLead } from '@/lib/modules/onboarding';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { name, email, phone, company, services, message, source, catalogItems } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const serviceName = Array.isArray(services) ? services.join(', ') : services || 'General Enquiry';
    const notes = [
      services?.length ? `Services: ${serviceName}` : null,
      message ? `Message: ${message}` : null,
      source ? `Source: ${source}` : null,
    ].filter(Boolean).join('\n\n');

    const result = await handleLead({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone || null,
      company: company || null,
      serviceName,
      notes,
      source: source || 'contact_form',
      // Shape-validated here, PRICED in onboarding.ts from the database.
      // Never accept a price from the browser.
      catalogItems: Array.isArray(catalogItems)
        ? catalogItems
            .filter((c: unknown): c is { id: string; quantity?: unknown } =>
              !!c && typeof (c as { id?: unknown }).id === 'string')
            .map((c) => ({
              id: c.id,
              quantity: Math.min(99, Math.max(1, Math.floor(Number(c.quantity) || 1))),
            }))
            .slice(0, 20)
        : undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    console.error('Contact API error:', e);
    return NextResponse.json({ error: e.message || 'Submission failed' }, { status: 500 });
  }
}
