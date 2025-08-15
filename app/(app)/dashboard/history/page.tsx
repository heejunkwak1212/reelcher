import { supabaseServer } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export const runtime = 'nodejs'

export default async function HistoryPage() {
  const ssr = await supabaseServer()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return null
  const { data: searches } = await ssr.from('searches').select('created_at, keyword, requested, returned, cost').order('created_at', { ascending: false }).limit(50)
  
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
          {searches.map((s: any, idx: number) => (
            <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <Badge variant="outline" className="text-xs font-mono">
                  #{s.keyword}
                </Badge>
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
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-gray-500 text-xs mb-1">요청</div>
                  <div className="font-medium text-blue-600">
                    {Number(s.requested || 0).toLocaleString()}개
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-gray-500 text-xs mb-1">반환</div>
                  <div className="font-medium text-green-600">
                    {Number(s.returned || 0).toLocaleString()}개
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-gray-500 text-xs mb-1">차감</div>
                  <div className="font-medium text-red-600">
                    {Number(s.cost || 0).toLocaleString()} 크레딧
                  </div>
                </div>
              </div>
              
              {/* 효율성 표시 */}
              {s.requested > 0 && (
                <>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">반환 효율</span>
                    <Badge 
                      variant={Math.round((s.returned / s.requested) * 100) >= 80 ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {Math.round((s.returned / s.requested) * 100)}%
                    </Badge>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


