// app/api/admin/apify/stats/route.ts
import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import ApifyMonitor from '@/lib/apify-monitor';

export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
    }

    // URL 파라미터에서 days 가져오기
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    // Apify 토큰 확인
    const apifyToken = process.env.APIFY_TOKEN;
    if (!apifyToken) {
      return new Response(JSON.stringify({ error: 'Apify token not configured' }), { status: 500 });
    }

    const monitor = new ApifyMonitor(apifyToken);
    const stats = await monitor.getDetailedUsageStats(days);

    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Apify stats API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch Apify stats' }),
      { status: 500 }
    );
  }
}
