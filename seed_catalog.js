const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://unzwefrtgsgmtljlbavf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuendlZnJ0Z3NnbXRsamxiYXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTM1MjMsImV4cCI6MjA5MjA4OTUyM30.QPoyf_UYDD82xW1KYaSbukPrfMoTAACVMKPT05HKI90'
);

async function seed() {
  console.log('Seeding OGraphy V4 catalog...\n');

  const items = [
    // IDENTITY SYSTEMS
    { name: 'Echo Launch Kit', category: 'identity', subcategory: 'brand_kit',
      description: 'Logo mark + 3 variants + mini brand system + color palette + typography selection. Everything you need to launch with a cohesive visual identity.',
      delivery: 'digital', turnaround: '5-7 days', base_price_usd: 180,
      price_note: 'From $180 — one-time project', style_tags: ['minimalist','bold'],
      format: ['digital'], is_featured: true, sort_order: 1 },

    { name: 'Brand Amplification', category: 'identity', subcategory: 'brand_kit',
      description: 'Full logo system + brand voice blueprint + Charte Graphique + cross-platform asset library. The complete identity architecture.',
      delivery: 'digital', turnaround: '2 weeks', base_price_usd: 555,
      price_note: 'From $555 — full system', style_tags: ['luxury','corporate'],
      format: ['digital'], is_featured: true, sort_order: 2 },

    { name: 'Fractional Creative Partner', category: 'identity', subcategory: 'retainer',
      description: 'Ongoing identity evolution + monthly asset production + strategic visual direction. Your creative department without the overhead.',
      delivery: 'digital', turnaround: 'Monthly', base_price_usd: 1200,
      price_note: '$1,200/mo — ongoing partnership', style_tags: ['corporate','luxury'],
      format: ['digital'], is_featured: true, sort_order: 3 },

    // CONTENT PRODUCTION
    { name: 'Social Media Starter Pack', category: 'content', subcategory: 'social',
      description: '10 Instagram posts + 5 stories, fully branded, Canva-ready and editable. Launch your social presence in one delivery.',
      delivery: 'digital', turnaround: '3-5 days', base_price_usd: 95,
      price_note: '$95 per set of 15 templates', style_tags: ['playful','bold'],
      format: ['digital'], is_featured: false, sort_order: 4 },

    { name: 'UGC Asset Kit', category: 'content', subcategory: 'social',
      description: '15 branded templates — posts, stories, reel covers, thumbnails. Designed for content creators who need volume with consistency.',
      delivery: 'digital', turnaround: '5 days', base_price_usd: 145,
      price_note: '$145 — 15 templates', style_tags: ['bold','organic'],
      format: ['digital'], is_featured: true, sort_order: 5 },

    { name: 'Monthly Content Bundle', category: 'content', subcategory: 'social',
      description: '30 templates per month, refreshed every 30 days. Never run out of on-brand content. Cancel anytime.',
      delivery: 'digital', turnaround: 'Monthly', base_price_usd: 280,
      price_note: '$280/mo — 30 templates', style_tags: ['minimalist','corporate'],
      format: ['digital'], is_featured: false, sort_order: 6 },

    // PRINT & PHYSICAL
    { name: 'Event Pull-Up Banner', category: 'print', subcategory: 'event',
      description: '85×200cm pull-up banner — design + print + delivery. Show up to your event with presence. One submission, one payment, banner arrives.',
      delivery: 'physical', turnaround: '5-7 days', base_price_usd: 85,
      price_note: 'From $85 — design + print + delivery', style_tags: ['corporate','bold'],
      format: ['custom'], is_featured: true, sort_order: 7 },

    { name: 'Business Card Set', category: 'print', subcategory: 'stationery',
      description: 'Custom designed business cards — 250 cards printed on premium stock + delivered. First impression, handled.',
      delivery: 'physical', turnaround: '5 days', base_price_usd: 65,
      price_note: '$65 — design + 250 cards + delivery', style_tags: ['minimalist','luxury'],
      format: ['custom'], is_featured: false, sort_order: 8 },

    { name: 'Framed Wall Print', category: 'print', subcategory: 'framing',
      description: 'Any design printed and framed, sizes A4 to A1. Museum-quality output, ready to hang. Design, print, frame, deliver — one flow.',
      delivery: 'physical', turnaround: '7-10 days', base_price_usd: 120,
      price_note: 'From $120 — depends on size', style_tags: ['luxury','organic'],
      format: ['A4','A3','A2','A1'], is_featured: false, sort_order: 9 },

    { name: 'Event Identity Kit', category: 'print', subcategory: 'event',
      description: 'Complete event visual system — badges, program booklet, backdrop design, signage. Everything coordinated, nothing mismatched.',
      delivery: 'both', turnaround: '1 week', base_price_usd: 320,
      price_note: 'From $320 — full event kit', style_tags: ['corporate','bold'],
      format: ['custom','digital'], is_featured: true, sort_order: 10 },

    // EDITORIAL & PRESENTATION
    { name: 'Pitch Deck Design', category: 'digital', subcategory: 'presentation',
      description: 'Up to 20 slides, fully branded, editable PowerPoint or Google Slides. Built to persuade, not just inform.',
      delivery: 'digital', turnaround: '5 days', base_price_usd: 220,
      price_note: 'From $220 — 20 slides', style_tags: ['corporate','minimalist'],
      format: ['digital'], is_featured: false, sort_order: 11 },

    { name: 'Business Proposal', category: 'digital', subcategory: 'document',
      description: 'Up to 15 pages, branded PDF + editable Word document. Professional proposals that close deals.',
      delivery: 'digital', turnaround: '4 days', base_price_usd: 180,
      price_note: 'From $180 — 15 pages', style_tags: ['corporate'],
      format: ['digital'], is_featured: false, sort_order: 12 },

    { name: 'Student CV & Portfolio', category: 'digital', subcategory: 'document',
      description: '2-page CV + cover letter, branded and polished. Stand out at graduation. First career move, handled.',
      delivery: 'digital', turnaround: '3 days', base_price_usd: 75,
      price_note: '$75 — CV + cover letter', style_tags: ['minimalist'],
      format: ['digital'], is_featured: false, sort_order: 13 },

    // PHOTO & VIDEO
    { name: 'Photo Retouch Pack', category: 'content', subcategory: 'photo',
      description: '50 photos, Lightroom color-graded + exported as high-res JPG. Upload raw, receive finished. Pure execution.',
      delivery: 'digital', turnaround: '3 days', base_price_usd: 75,
      price_note: '$75 per 50 images', style_tags: ['organic'],
      format: ['digital'], is_featured: false, sort_order: 14 },

    { name: 'Custom Lightroom Preset Pack', category: 'content', subcategory: 'photo',
      description: '5 custom Lightroom presets built to match your visual style. Apply your look to any photo, forever.',
      delivery: 'digital', turnaround: '3 days', base_price_usd: 45,
      price_note: '$45 — 5 presets', style_tags: ['organic','minimalist'],
      format: ['digital'], is_featured: false, sort_order: 15 },

    // EVENT MEDIA (bridge to Product B)
    { name: 'Same-Day Event Edits', category: 'event', subcategory: 'media',
      description: 'Professional photo + video edits delivered the same day as your event. The memory layer — captured and polished before the night ends.',
      delivery: 'digital', turnaround: 'Same day', base_price_usd: 350,
      price_note: 'From $350 — same-day delivery', style_tags: ['bold','luxury'],
      format: ['digital'], is_featured: true, sort_order: 16 },

    { name: 'Event Photo Package', category: 'event', subcategory: 'media',
      description: 'Full event coverage — 200+ edited photos delivered within 48 hours. Every moment documented, color-graded, ready to share.',
      delivery: 'digital', turnaround: '48 hours', base_price_usd: 280,
      price_note: 'From $280 — 200+ photos', style_tags: ['bold'],
      format: ['digital'], is_featured: false, sort_order: 17 },
  ];

  const { data, error } = await supabase.from('catalog_items').insert(items).select();

  if (error) {
    console.log('Error:', error.message);
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log('Some items may already exist. Checking current count...');
    }
  } else {
    console.log(`✓ Inserted ${data.length} catalog items`);
  }

  // Verify
  const { data: all, error: countErr } = await supabase.from('catalog_items').select('id,name,category,base_price_usd');
  if (countErr) {
    console.log('Count error:', countErr.message);
  } else {
    console.log(`\nTotal items in catalog: ${all.length}`);
    all.forEach(i => console.log(`  ${i.category.padEnd(10)} | $${(i.base_price_usd||0).toString().padStart(6)} | ${i.name}`));
  }

  // Also verify other tables exist
  for (const table of ['clients','projects','briefs','payments','deliverables','brief_files']) {
    const { error: tErr } = await supabase.from(table).select('id').limit(1);
    if (tErr) {
      console.log(`✗ Table '${table}': ${tErr.message}`);
    } else {
      console.log(`✓ Table '${table}' exists`);
    }
  }
}

seed().catch(console.error);
