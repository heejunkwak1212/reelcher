import { supabaseServer } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Calendar, Hash, User, Link as LinkIcon, MessageSquare, Clock, TrendingUp, ArrowUpRight } from 'lucide-react'

export const runtime = 'nodejs'

export default async function HistoryPage() {
  const ssr = await supabaseServer()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return null
  
  // search_history 테이블에서 14일 이내 이력 조회 (자막 추출 포함)
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  
  const { data: searches } = await ssr
    .from('search_history')
    .select('created_at, platform, search_type, keyword, results_count, credits_used, filters')
    .eq('user_id', user.id)
    .gte('created_at', fourteenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(100) // 14일 이내로 제한하므로 개수 제한 증가
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">사용 이력</h1>
        <Badge variant="secondary" className="text-xs px-3 py-1">
          최근 14일
        </Badge>
      </div>
      
      {(!searches || searches.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 p-4 mb-4">
            <Clock className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">아직 검색 이력이 없습니다</h3>
          <p className="text-gray-500 text-sm">검색을 시작하면 여기에 이력이 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {searches.map((s: any, idx: number) => {
            // 플랫폼별 공식 아이콘 정의 (search 페이지와 동일)
            const getPlatformIcon = (platform: string) => {
              switch (platform) {
                case 'instagram':
                  return (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  )
                case 'youtube':
                  return (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  )
                case 'tiktok':
                  return (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-1.032-.083 6.411 6.411 0 0 0-6.41 6.41 6.411 6.411 0 0 0 6.41 6.41 6.411 6.411 0 0 0 6.41-6.41V9.054a8.05 8.05 0 0 0 4.6 1.432v-3.4a4.751 4.751 0 0 1-.745-.4z"/>
                    </svg>
                  )
                default:
                  return <Hash className="w-4 h-4" />
              }
            }
            
            const platformNames = {
              instagram: 'Instagram',
              youtube: 'YouTube', 
              tiktok: 'TikTok'
            }
            
            // 검색 타입별 아이콘과 표시
            const getSearchTypeInfo = () => {
              switch (s.search_type) {
                case 'profile':
                  return { icon: User, text: '프로필' }
                case 'url':
                  return { icon: LinkIcon, text: 'URL' }
                case 'hashtag':
                  return { icon: Hash, text: '키워드' }
                case 'subtitle_extraction':
                  return { icon: MessageSquare, text: '자막 추출' }
                default:
                  return { icon: Hash, text: '키워드' }
              }
            }
            const typeInfo = getSearchTypeInfo()
            const TypeIcon = typeInfo.icon
            
            // 크레딧 반환 계산 (예시: 실제 결과가 요청보다 적을 때)
            const expectedCredits = s.filters?.expected_credits || s.credits_used
            const actualCredits = s.credits_used || 0
            const refundedCredits = Math.max(0, (expectedCredits || 0) - actualCredits)
            
            return (
              <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all duration-200">
                {/* 첫 번째 줄: 플랫폼 + 검색타입 + 시간 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {/* 플랫폼 아이콘 */}
                    <div className="flex items-center gap-2">
                      <div className="text-gray-700">
                        {getPlatformIcon(s.platform)}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {platformNames[s.platform as keyof typeof platformNames] || s.platform}
                      </span>
                    </div>
                    
                    {/* 검색 타입 */}
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-md">
                      <TypeIcon className="h-3 w-3 text-gray-500" />
                      <span className="text-xs text-gray-600 font-medium">{typeInfo.text}</span>
                    </div>
                  </div>
                  
                  {/* 시간 */}
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(s.created_at).toLocaleDateString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                
                {/* 두 번째 줄: 키워드/URL */}
                <div className="mb-3">
                  <div className="text-sm text-gray-900 font-medium">
                    {s.search_type === 'subtitle_extraction' && s.filters?.url ? (
                      <span className="break-all" title={s.filters.url}>
                        {s.filters.url.length > 80 ? s.filters.url.substring(0, 80) + '...' : s.filters.url}
                      </span>
                    ) : (
                      <span>
                        {s.keyword || '검색어 없음'}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* 세 번째 줄: 결과 수 + 크레딧 정보 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* 결과/상태 */}
                    <div className="flex items-center gap-1.5">
                      {s.search_type === 'subtitle_extraction' ? (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-green-700 font-medium">완료</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-3 w-3 text-blue-600" />
                          <span className="text-sm text-gray-700">
                            <span className="font-medium">{Number(s.results_count || 0).toLocaleString()}</span>
                            <span className="text-gray-500 ml-1">개 결과</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* 크레딧 정보 */}
                  <div className="flex items-center gap-3">
                    {/* 반환 크레딧 (있을 경우) */}
                    {refundedCredits > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <ArrowUpRight className="h-3 w-3 text-green-600" />
                        <span className="text-green-600 font-medium">+{refundedCredits}</span>
                        <span className="text-gray-500">반환</span>
                      </div>
                    )}
                    
                    {/* 사용 크레딧 */}
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-gray-500">사용:</span>
                      <span className="font-semibold text-red-600">
                        -{Number(actualCredits).toLocaleString()}
                      </span>
                      <span className="text-gray-500 text-xs">크레딧</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}



