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
        <h1 className="text-2xl font-semibold text-gray-900">관리자 대시보드</h1>
        <div className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-md">
          실시간 현황
        </div>
      </div>
      
      {/* 메인 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-xs font-medium text-gray-500 mb-1">총 사용자</h3>
          <p className="text-2xl font-semibold text-gray-900">{userCount?.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1 flex items-center">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
            오늘 +{todaySignups}
          </p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-xs font-medium text-gray-500 mb-1">총 검색</h3>
          <p className="text-2xl font-semibold text-gray-900">{searchCount?.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">누적 검색 수</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-xs font-medium text-gray-500 mb-1">유료 사용자</h3>
          <p className="text-2xl font-semibold text-gray-900">
            {((planCounts.starter || 0) + (planCounts.pro || 0) + (planCounts.business || 0)).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1 flex items-center">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></span>
            {Math.round(((planCounts.starter || 0) + (planCounts.pro || 0) + (planCounts.business || 0)) / (userCount || 1) * 100)}% 전환율
          </p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-xs font-medium text-gray-500 mb-1">무료 사용자</h3>
          <p className="text-2xl font-semibold text-gray-900">{(planCounts.free || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">FREE 플랜</p>
        </div>
      </div>

      {/* 플랜별 현황 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-medium mb-4 text-gray-900">플랜별 사용자 현황</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
            <div className="text-2xl font-semibold text-gray-900">{planCounts.free || 0}</div>
            <div className="text-xs text-gray-500 mt-1">FREE</div>
          </div>
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
            <div className="text-2xl font-semibold text-gray-900">{planCounts.starter || 0}</div>
            <div className="text-xs text-gray-500 mt-1">STARTER</div>
          </div>
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
            <div className="text-2xl font-semibold text-gray-900">{planCounts.pro || 0}</div>
            <div className="text-xs text-gray-500 mt-1">PRO</div>
          </div>
          <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
            <div className="text-2xl font-semibold text-gray-900">{planCounts.business || 0}</div>
            <div className="text-xs text-gray-500 mt-1">BUSINESS</div>
          </div>
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/admin/users" className="group block bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center group-hover:border-gray-300 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m3 5.197V9a3 3 0 00-6 0v2.053" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 group-hover:text-gray-700">사용자 관리</h3>
              <p className="text-sm text-gray-500 group-hover:text-gray-600">사용자 목록 및 상세 정보</p>
            </div>
          </div>
        </a>
        
        <a href="/admin/searches" className="group block bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center group-hover:border-gray-300 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 group-hover:text-gray-700">검색 분석</h3>
              <p className="text-sm text-gray-500 group-hover:text-gray-600">검색 통계 및 트렌드</p>
            </div>
          </div>
        </a>
        
        <a href="/admin/credits" className="group block bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center group-hover:border-gray-300 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0 2.08-.402-2.599-1" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 group-hover:text-gray-700">크레딧 관리</h3>
              <p className="text-sm text-gray-500 group-hover:text-gray-600">크레딧 사용량 및 충전</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  )
}


