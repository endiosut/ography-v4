import { NextRequest, NextResponse } from 'next/server';
import { handleLead } from '@/lib/modules/onboarding';

export async function POST(req: NextRequest) {
  const body = await req.text();
  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email;
    const name = session.customer_details?.name || email?.split('@')[0] || 'Client';
    const amountPaid = (session.amount_total || 0) / 100;
    const serviceName = session.metadata?.service_name || 'Studio Service';
    const catalogItemId = session.metadata?.catalog_item_id || null;

    if (!email) return NextResponse.json({ error: 'No email' }, { status: 400 });

    try {
      await handleLead({
        name,
        email,
        serviceName,
        source: 'stripe',
        stripeSessionId: session.id,
        amountPaid,
        catalogItemId,
        deliveryType: session.metadata?.delivery_type || 'digital',
      });
    } catch (e: any) {
      console.error('Stripe webhook error:', e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
