import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const { fileName, signCount } = await req.json();

    if (!fileName || typeof signCount !== 'number') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const detectionStatus = signCount > 0 ? 'successful' : 'unsuccessful';

    const { data, error } = await supabase
      .from('recent_mutcd_files')
      .update({
        sign_count: signCount,
        processed_at: new Date().toISOString(),
        detection_status: detectionStatus,
      })
      .eq('file_name', fileName)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: data });
  } catch (error) {
    console.error('API update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
