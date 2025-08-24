"use client"
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const [credit, setCredit] = useState<number | null>(null)
  const [recent, setRecent] = useState<number | null>(null)
  const [searches, setSearches] = useState<any[]>([])
  const [todayUsage, setTodayUsage] = useState<number>(0)
  const [monthlyUsage, setMonthlyUsage] = useState<number>(0)
  
  useEffect(() => {
    const run = async () => {
      try {
      const supabase = supabaseBrowser()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError) {
          console.error('❌ 대시보드 인증 오류:', authError)
          return
        }
        
        if (!user) {
          console.warn('⚠️ 대시보드 사용자 없음')
          return
        }
        
        console.log('🔄 대시보드 데이터 로딩 시작:', user.id)
      
      // 크레딧 정보
        const { data: credits, error: creditsError } = await supabase
          .from('credits')
          .select('balance')
          .eq('user_id', user.id)
          .single()
        
        if (creditsError) {
          console.error('❌ 크레딧 조회 오류:', creditsError)
          setCredit(0)
        } else {
          setCredit(credits?.balance ?? 0)
          console.log('✅ 크레딧 로드 완료:', credits?.balance)
        }
        
        // 14일 이내 검색 기록과 통계를 병렬로 가져오기
        const fourteenDaysAgo = new Date()
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
        
        const [searchHistoryRes, statsRes] = await Promise.all([
          supabase
            .from('search_history')
            .select('*')
            .eq('user_id', user.id)
            .neq('search_type', 'subtitle_extraction') // 자막 추출 제외
            .gte('created_at', fourteenDaysAgo.toISOString()) // 14일 이내만
            .order('created_at', { ascending: false })
            .limit(5),
          fetch('/api/me/stats', { 
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }).then(r => r.ok ? r.json() : null).catch(e => {
            console.error('❌ 통계 API 호출 오류:', e)
            return null
          })
        ])
        
        if (searchHistoryRes.error) {
          console.error('❌ 검색 기록 조회 오류:', searchHistoryRes.error)
          setSearches([])
        } else {
          const allSearches = searchHistoryRes.data || []
          setSearches(allSearches.slice(0, 10))
          console.log('✅ 검색 기록 로드 완료:', allSearches.length)
        }
        
        // 통계 데이터 설정
        if (statsRes) {
          setTodayUsage(statsRes.today_searches || 0) // 오늘 검색 수로 변경
          setMonthlyUsage(statsRes.month_credits || 0) 
          setRecent(statsRes.total_searches || 0)
          console.log('✅ 대시보드 통계 로드 완료:', {
            todayUsage: statsRes.today_searches,
            monthlyUsage: statsRes.month_credits,
            totalSearches: statsRes.total_searches
          })
        } else {
          console.warn('⚠️ 대시보드 통계 로드 실패, 기본값 설정')
          setTodayUsage(0)
          setMonthlyUsage(0)
          setRecent(0)
        }
      } catch (error) {
        console.error('❌ 대시보드 전체 로딩 오류:', error)
        // 에러 발생 시 기본값 설정
        setCredit(0)
        setTodayUsage(0)
        setMonthlyUsage(0)
        setRecent(0)
        setSearches([])
      }
    }
    
    run()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-900">내 검색 기록</h1>
            <p className="text-gray-600 text-sm mt-1">검색 활동과 크레딧 사용량을 관리하세요</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="text-sm text-gray-500 mb-1">오늘</div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{todayUsage.toLocaleString()}</div>
            <div className="text-xs text-gray-500">검색 수</div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="text-sm text-gray-500 mb-1">이번 달</div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{monthlyUsage.toLocaleString()}</div>
            <div className="text-xs text-gray-500">크레딧 사용량</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Search History */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">검색 기록</h2>
                <Link href="/dashboard/history">
                  <Button variant="outline" size="sm" className="text-gray-600 hover:text-gray-900">
                    전체보기
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">검색어</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">플랫폼</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">일시</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">사용 크레딧</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {searches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        아직 검색 기록이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    searches.map((search, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-gray-900">
                            {search.search_type === 'profile' ? (
                              <div className="flex flex-col items-center">
                                <span className="text-purple-600 font-medium">{search.keyword || '프로필 없음'}</span>
                                <span className="text-xs text-gray-500">프로필 검색</span>
                              </div>
                            ) : search.search_type === 'url' ? (
                              <div className="flex flex-col items-center">
                                <span className="text-blue-600 font-medium truncate max-w-xs" title={search.keyword}>
                                  {search.keyword || 'URL 없음'}
                                </span>
                                <span className="text-xs text-gray-500">URL 검색</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span>{search.keyword || '검색어 없음'}</span>
                                <span className="text-xs text-gray-500">키워드 검색</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                            {search.platform || 'Instagram'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            완료
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                          {search.created_at ? new Date(search.created_at).toLocaleDateString('ko-KR') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                          {search.credits_used ? `${search.credits_used.toLocaleString()}` : '0'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right - Account Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">계정 정보</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500">잔여 크레딧</div>
                  <div className="text-2xl font-bold text-gray-900">{credit?.toLocaleString() ?? '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">이번달 검색량</div>
                  <div className="text-lg font-semibold text-gray-900">{recent ?? '-'}</div>
                </div>
              </div>
            </div>

            <SubscriptionManager />
          </div>
        </div>
      </div>
    </div>
  )
}

function SubscriptionManager() {
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  useEffect(()=>{ (async()=>{ const j = await fetch('/api/me',{cache:'no-store'}).then(r=>r.json()).catch(()=>null); setMe(j) })() },[])
  const changePlan = async (p: 'starter'|'pro'|'business') => {
    setLoading(true)
    try {
      const res = await fetch('/api/subscriptions/change', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ plan: p }) })
      if (!res.ok) throw new Error(await res.text())
      alert('플랜이 변경되었습니다')
      location.reload()
    } catch(e:any){ alert(e?.message||'변경 실패') } finally { setLoading(false) }
  }
  const cancel = async () => {
    if (!confirm('구독을 취소하시겠어요?')) return
    setLoading(true)
    try {
      const res = await fetch('/api/subscriptions/cancel', { method:'POST' })
      if (!res.ok) throw new Error(await res.text())
      alert('구독이 취소되었습니다')
      location.reload()
    } catch(e:any){ alert(e?.message||'취소 실패') } finally { setLoading(false) }
  }
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">구독 관리</h3>
      <div className="space-y-4">
        <div>
          <div className="text-sm text-gray-500">현재 플랜</div>
          <div className="text-lg font-semibold text-gray-900 capitalize">{me?.plan || 'Free'}</div>
        </div>
        <div className="space-y-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={()=>changePlan('starter')} 
            disabled={loading}
            className="w-full justify-start"
          >
            Starter로 변경
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={()=>changePlan('pro')} 
            disabled={loading}
            className="w-full justify-start"
          >
            Pro로 변경
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={()=>changePlan('business')} 
            disabled={loading}
            className="w-full justify-start"
          >
            Business로 변경
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={cancel} 
            disabled={loading}
            className="w-full"
          >
            구독 취소
          </Button>
        </div>
      </div>
    </div>
  )
}


