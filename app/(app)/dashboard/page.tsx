"use client"
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const [credit, setCredit] = useState<number | null>(null)
  const [recent, setRecent] = useState<number | null>(null)
  const [searches, setSearches] = useState<any[]>([])
  const [weeklyUsage, setWeeklyUsage] = useState<number>(0)
  const [todayUsage, setTodayUsage] = useState<number>(0)
  
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
        
        // 검색 기록과 통계를 병렬로 가져오기
        const [searchHistoryRes, statsRes] = await Promise.all([
          supabase
            .from('search_history')
            .select('*')
            .eq('user_id', user.id)
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
          setWeeklyUsage(statsRes.week_credits || 0)
          setTodayUsage(statsRes.month_credits || 0) 
          setRecent(statsRes.total_searches || 0)
          console.log('✅ 대시보드 통계 로드 완료:', {
            weeklyUsage: statsRes.week_credits,
            monthlyUsage: statsRes.month_credits,
            totalSearches: statsRes.total_searches
          })
        } else {
          console.warn('⚠️ 대시보드 통계 로드 실패, 기본값 설정')
          setWeeklyUsage(0)
          setTodayUsage(0)
          setRecent(0)
        }
      } catch (error) {
        console.error('❌ 대시보드 전체 로딩 오류:', error)
        // 에러 발생 시 기본값 설정
        setCredit(0)
        setWeeklyUsage(0)
        setTodayUsage(0)
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">내 검색 기록</h1>
            <p className="text-gray-600 text-sm mt-1">검색 활동과 크레딧 사용량을 관리하세요</p>
          </div>
          <Link href="/search">
            <Button className="bg-black text-white hover:bg-gray-800">
              새 검색 시작
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="text-sm text-gray-500 mb-1">이번 주</div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{weeklyUsage.toLocaleString()}</div>
            <div className="text-xs text-gray-500">크레딧 사용량</div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="text-sm text-gray-500 mb-1">이번 달</div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{todayUsage.toLocaleString()}</div>
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
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>Week</span>
                  <span>Month</span>
                  <span>Year</span>
                  <button className="text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                  <button className="text-gray-400 hover:text-gray-600">Export</button>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">검색어</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">플랫폼</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">일시</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용 크레딧</th>
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {search.search_type === 'profile' ? (
                              <button 
                                className="text-blue-600 hover:text-blue-800 underline"
                                onClick={() => alert(`프로필: ${search.keyword || search.profile_username || '알 수 없음'}`)}
                              >
                                프로필
                              </button>
                            ) : search.search_type === 'url' ? (
                              <button 
                                className="text-blue-600 hover:text-blue-800 underline"
                                onClick={() => alert(`URL: ${search.url || '알 수 없음'}`)}
                              >
                                URL
                              </button>
                            ) : (
                              search.keyword || '검색어 없음'
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                            {search.platform || 'Instagram'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            완료
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {search.created_at ? new Date(search.created_at).toLocaleDateString('ko-KR') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
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
                  <div className="text-sm text-gray-500">총 검색 수</div>
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


