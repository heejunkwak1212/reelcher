import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 관리자 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 })
    }

    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '10', 10)
    const offset = (page - 1) * limit

    const supabaseAdmin = supabaseService()

    // 마케팅 수신동의한 사용자 총 개수 조회
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('marketing_consent', true)

    // 마케팅 수신동의한 사용자 목록 조회 (이메일 포함)
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        user_id,
        display_name,
        email,
        marketing_consent,
        plan,
        created_at,
        onboarding_completed
      `)
      .eq('marketing_consent', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('마케팅 수신동의 사용자 조회 오류:', error)
      return Response.json({ error: 'Database query failed' }, { status: 500 })
    }

    return Response.json({
      users: profiles || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    })

  } catch (error) {
    console.error('마케팅 수신동의 사용자 조회 실패:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
