import { supabaseServer } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export const runtime = 'nodejs'

export default async function HistoryPage() {
  const ssr = await supabaseServer()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return null
  
  // search_history 테이블에서 검색 이력 조회 (자막 추출 제외)
  const { data: searches } = await ssr
    .from('search_history')
    .select('created_at, platform, search_type, keyword, results_count, credits_used, filters')
    .eq('user_id', user.id)
    .neq('search_type', 'subtitle_extraction') // 자막 추출 제외
    .order('created_at', { ascending: false })
    .limit(50)
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">사용 이력</h1>
        <Badge variant="secondary" className="text-xs">
          최근 50건
        </Badge>
      </div>
      
      {(!searches || searches.length === 0) ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">📊</div>
          <p className="text-gray-500 text-sm">아직 검색 이력이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {searches.map((s: any, idx: number) => {
            // 플랫폼별 색상 및 아이콘
            const platformInfo = {
              instagram: { color: 'bg-pink-100 text-pink-800', icon: '📷', name: 'Instagram' },
              youtube: { color: 'bg-red-100 text-red-800', icon: '📹', name: 'YouTube' },
              tiktok: { color: 'bg-purple-100 text-purple-800', icon: '🎵', name: 'TikTok' }
            }
            const info = platformInfo[s.platform as keyof typeof platformInfo] || 
                        { color: 'bg-gray-100 text-gray-800', icon: '🔍', name: s.platform }
            
            // 검색 타입별 표시
            const searchTypeText = s.search_type === 'profile' ? '프로필' : 
                                  s.search_type === 'url' ? 'URL' : 
                                  s.search_type === 'hashtag' ? '해시태그' : '키워드'
            
            return (
              <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${info.color}`}>
                      {info.icon} {info.name}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {searchTypeText}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(s.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                
                {/* 키워드/URL/프로필 표시 */}
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {s.search_type === 'url' ? (
                      <span className="text-blue-600" title={s.keyword}>
                        {s.keyword || 'URL 없음'}
                      </span>
                    ) : s.search_type === 'profile' ? (
                      <span className="text-purple-600" title={s.keyword}>
                        {s.keyword || '프로필 없음'}
                      </span>
                    ) : (
                      s.keyword || '검색어 없음'
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-gray-500 text-xs mb-1">결과 수</div>
                    <div className="font-medium text-green-600">
                      {Number(s.results_count || 0).toLocaleString()}개
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-gray-500 text-xs mb-1">사용 크레딧</div>
                    <div className="font-medium text-red-600">
                      {Number(s.credits_used || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                
                {/* 필터 정보 표시 (있는 경우) */}
                {s.filters && Object.keys(s.filters).length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <div className="text-xs text-gray-500">
                      <span className="font-medium">필터: </span>
                      {Object.entries(s.filters).map(([key, value]) => (
                        <span key={key} className="mr-2">
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


