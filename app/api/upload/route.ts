import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;  // Server-side full access

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Invalid PDF file' }, { status: 400 });
    }

    const filePath = `${Date.now()}-${file.name}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('recent_mutcd_files')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Insert metadata to table
    const { data, error: dbError } = await supabase.from('recent_mutcd_files').insert({
      file_name: file.name,
      sign_count: 0,
      processed_at: new Date().toISOString(),
      detection_status: 'not-started',
      file_path: filePath,
    }).select().single();

    if (dbError) {
      console.error('DB insert error:', dbError);
      // Cleanup storage on DB fail
      await supabase.storage.from('recent_mutcd_files').remove([filePath]);
      return NextResponse.json({ error: 'Failed to save metadata' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id, message: 'File uploaded successfully' });
  } catch (error) {
    console.error('API upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
