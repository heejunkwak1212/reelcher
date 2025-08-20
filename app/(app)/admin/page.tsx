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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
        <div className="text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          실시간 현황
        </div>
      </div>
      
      {/* 메인 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white border border-gray-700 rounded-xl p-6 shadow-lg">
          <h3 className="text-sm font-medium text-gray-300 mb-2">총 사용자</h3>
          <p className="text-3xl font-bold text-white">{userCount?.toLocaleString()}</p>
          <p className="text-xs text-green-400 mt-2 flex items-center">
            <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
            오늘 +{todaySignups}
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-gray-800 to-gray-700 text-white border border-gray-600 rounded-xl p-6 shadow-lg">
          <h3 className="text-sm font-medium text-gray-300 mb-2">총 검색</h3>
          <p className="text-3xl font-bold text-white">{searchCount?.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-2">누적 검색 수</p>
        </div>
        
        <div className="bg-gradient-to-br from-gray-700 to-gray-600 text-white border border-gray-500 rounded-xl p-6 shadow-lg">
          <h3 className="text-sm font-medium text-gray-300 mb-2">유료 사용자</h3>
          <p className="text-3xl font-bold text-white">
            {((planCounts.starter || 0) + (planCounts.pro || 0) + (planCounts.business || 0)).toLocaleString()}
          </p>
          <p className="text-xs text-blue-400 mt-2 flex items-center">
            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
            {Math.round(((planCounts.starter || 0) + (planCounts.pro || 0) + (planCounts.business || 0)) / (userCount || 1) * 100)}% 전환율
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-gray-600 to-gray-500 text-white border border-gray-400 rounded-xl p-6 shadow-lg">
          <h3 className="text-sm font-medium text-gray-300 mb-2">무료 사용자</h3>
          <p className="text-3xl font-bold text-white">{(planCounts.free || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-2">FREE 플랜</p>
        </div>
      </div>

      {/* 플랜별 현황 */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 shadow-lg">
        <h2 className="text-xl font-semibold mb-6 text-white">플랜별 사용자 현황</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-6 bg-gray-800 border border-gray-700 rounded-lg">
            <div className="text-3xl font-bold text-gray-300">{planCounts.free || 0}</div>
            <div className="text-sm text-gray-400 mt-2">FREE</div>
          </div>
          <div className="text-center p-6 bg-blue-900 border border-blue-700 rounded-lg">
            <div className="text-3xl font-bold text-blue-300">{planCounts.starter || 0}</div>
            <div className="text-sm text-blue-400 mt-2">STARTER</div>
          </div>
          <div className="text-center p-6 bg-purple-900 border border-purple-700 rounded-lg">
            <div className="text-3xl font-bold text-purple-300">{planCounts.pro || 0}</div>
            <div className="text-sm text-purple-400 mt-2">PRO</div>
          </div>
          <div className="text-center p-6 bg-green-900 border border-green-700 rounded-lg">
            <div className="text-3xl font-bold text-green-300">{planCounts.business || 0}</div>
            <div className="text-sm text-green-400 mt-2">BUSINESS</div>
          </div>
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a href="/admin/users" className="group block bg-gray-800 border border-gray-700 rounded-xl p-8 hover:bg-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-900 rounded-xl flex items-center justify-center group-hover:bg-blue-800 transition-colors">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m3 5.197V9a3 3 0 00-6 0v2.053" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-gray-100">사용자 관리</h3>
              <p className="text-sm text-gray-400 group-hover:text-gray-300">사용자 목록 및 상세 정보</p>
            </div>
          </div>
        </a>
        
        <a href="/admin/searches" className="group block bg-gray-800 border border-gray-700 rounded-xl p-8 hover:bg-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-900 rounded-xl flex items-center justify-center group-hover:bg-green-800 transition-colors">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-gray-100">검색 분석</h3>
              <p className="text-sm text-gray-400 group-hover:text-gray-300">검색 통계 및 트렌드</p>
            </div>
          </div>
        </a>
        
        <a href="/admin/credits" className="group block bg-gray-800 border border-gray-700 rounded-xl p-8 hover:bg-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-900 rounded-xl flex items-center justify-center group-hover:bg-yellow-800 transition-colors">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0 2.08-.402-2.599-1" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-gray-100">크레딧 관리</h3>
              <p className="text-sm text-gray-400 group-hover:text-gray-300">크레딧 사용량 및 충전</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  )
}


