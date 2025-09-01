import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize') || '100')))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const fromDate = url.searchParams.get('from')
  const toDate = url.searchParams.get('to')

  const ssr = await supabaseServer()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { data: prof } = await ssr.from('profiles').select('role').eq('user_id', user.id).single()
  if (prof?.role !== 'admin') return new Response('Forbidden', { status: 403 })

  const svc = supabaseService()
  
  // search_history 먼저 가져오기
  let searchQuery = svc.from('search_history').select('*', { count: 'exact' })
  
  if (fromDate) searchQuery = searchQuery.gte('created_at', fromDate)
  if (toDate) searchQuery = searchQuery.lte('created_at', toDate)
  
  const { data: searchHistory, count, error: searchError } = await searchQuery
    .order('created_at', { ascending: false })
    .range(from, to)

  if (searchError) {
    console.error('Admin searches API error:', searchError)
    return new Response(JSON.stringify({ error: searchError.message }), { status: 500 })
  }

  if (!searchHistory || searchHistory.length === 0) {
    return Response.json({ 
      items: [], 
      total: count || 0, 
      page, 
      pageSize, 
      from: fromDate, 
      to: toDate 
    })
  }

  // 유저 ID들 추출
  const userIds = [...new Set(searchHistory.map(item => item.user_id))]
  
  // 유저 정보 가져오기 (profiles 테이블에 email 컬럼 추가 필요)
  const { data: profiles, error: profileError } = await svc
    .from('profiles')
    .select('user_id, plan, subscription_start_date, last_payment_date, display_name, email')
    .in('user_id', userIds)

  if (profileError) {
    console.error('Profiles fetch error:', profileError)
  }

  // 데이터 조합 (profiles에서 이메일 정보 직접 사용)
  const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || [])

  const transformedData = searchHistory.map(item => {
    const profile = profileMap.get(item.user_id)
    
    return {
      ...item,
      user_email: profile?.email || profile?.display_name || `user_${item.user_id.slice(0, 8)}`,
      user_plan: profile?.plan || 'free',
      subscription_start_date: profile?.subscription_start_date,
      last_payment_date: profile?.last_payment_date,
    }
  })

  return Response.json({ 
    items: transformedData, 
    total: count || 0, 
    page, 
    pageSize, 
    from: fromDate, 
    to: toDate 
  })
}


