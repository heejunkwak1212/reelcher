import { supabaseServer } from '@/lib/supabase/server'

export default async function AdminPage() {
  const supabase = await supabaseServer()
  
  // 기본 통계
  const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const { count: searchCount } = await supabase.from('searches').select('*', { count: 'exact', head: true })
  
  // 플랜별 사용자 수
  const { data: planStats } = await supabase
    .from('profiles')
    .select('plan')
    .not('plan', 'is', null)
  
  const planCounts = planStats?.reduce((acc: Record<string, number>, user) => {
    const plan = user.plan || 'free'
    acc[plan] = (acc[plan] || 0) + 1
    return acc
  }, {}) || {}

  // 오늘 가입한 사용자
  const today = new Date().toISOString().split('T')[0]
  const { count: todaySignups } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">관리자 대시보드</h1>
        <div className="text-sm text-gray-500">
          실시간 현황
        </div>
      </div>
      
      {/* 메인 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">총 사용자</h3>
          <p className="text-2xl font-bold text-gray-900">{userCount?.toLocaleString()}</p>
          <p className="text-xs text-green-600 mt-1">오늘 +{todaySignups}</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">총 검색</h3>
          <p className="text-2xl font-bold text-gray-900">{searchCount?.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">누적 검색 수</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">유료 사용자</h3>
          <p className="text-2xl font-bold text-gray-900">
            {((planCounts.starter || 0) + (planCounts.pro || 0) + (planCounts.business || 0)).toLocaleString()}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            {Math.round(((planCounts.starter || 0) + (planCounts.pro || 0) + (planCounts.business || 0)) / (userCount || 1) * 100)}% 전환율
          </p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">무료 사용자</h3>
          <p className="text-2xl font-bold text-gray-900">{(planCounts.free || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">FREE 플랜</p>
        </div>
      </div>

      {/* 플랜별 현황 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">플랜별 사용자 현황</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">{planCounts.free || 0}</div>
            <div className="text-sm text-gray-500">FREE</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{planCounts.starter || 0}</div>
            <div className="text-sm text-blue-500">STARTER</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{planCounts.pro || 0}</div>
            <div className="text-sm text-purple-500">PRO</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{planCounts.business || 0}</div>
            <div className="text-sm text-green-500">BUSINESS</div>
          </div>
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/admin/users" className="block bg-white border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m3 5.197V9a3 3 0 00-6 0v2.053" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">사용자 관리</h3>
              <p className="text-sm text-gray-600">사용자 목록 및 상세 정보</p>
            </div>
          </div>
        </a>
        
        <a href="/admin/searches" className="block bg-white border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">검색 분석</h3>
              <p className="text-sm text-gray-600">검색 통계 및 트렌드</p>
            </div>
          </div>
        </a>
        
        <a href="/admin/credits" className="block bg-white border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">크레딧 관리</h3>
              <p className="text-sm text-gray-600">크레딧 사용량 및 충전</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  )
}


