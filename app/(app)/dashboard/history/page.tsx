'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table2'
import { Calendar, Hash, User, Link as LinkIcon, MessageSquare, Clock, TrendingUp, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { ExpandableText } from '@/components/ui/expandable-text'
import { Button } from '@/components/ui/button'

export default function HistoryPage() {
  const [searches, setSearches] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const ITEMS_PER_PAGE = 30
  
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()

      console.log('🔍 History - 사용자 정보:', user)

      if (!user) {
        console.log('❌ History - 사용자 없음')
        return
      }

      // 최근 30일 이내 이력 조회
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      console.log('📅 History - 조회 기간:', thirtyDaysAgo.toISOString(), '~', new Date().toISOString())
      console.log('👤 History - 사용자 ID:', user.id)

      // 전체 개수 조회
      const { count, error: countError } = await supabase
        .from('search_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())

      console.log('📊 History - 전체 개수 결과:', { count, countError })

      // 페이지네이션된 데이터 조회
      const { data: searches, error: searchError } = await supabase
        .from('search_history')
        .select('created_at, platform, search_type, keyword, results_count, credits_used, refund_amount, status, filters')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1)

      console.log('📋 History - 검색 결과:', { searches, searchError, length: searches?.length })

      setSearches(searches || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('❌ 검색 이력 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, ITEMS_PER_PAGE])
  
  useEffect(() => {
    fetchData()
  }, [fetchData, currentPage])
  
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  
  return (
    <div className="space-y-6">
      {loading ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="text-gray-500">로딩 중...</div>
            </div>
          </CardContent>
        </Card>
      ) : (!searches || searches.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-gray-100 p-4 mb-4">
              <Clock className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">아직 검색 이력이 없습니다</h3>
            <p className="text-gray-500 text-sm">검색을 시작하면 여기에 이력이 표시됩니다.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">검색 이력</CardTitle>
                <p className="text-sm text-gray-600">총 {totalCount}개의 검색 기록 (페이지 {currentPage}/{totalPages})</p>
              </div>
              <Badge variant="secondary" className="text-xs px-3 py-1">
                최근 30일
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[15%] px-3 font-bold text-gray-800 text-center">플랫폼</TableHead>
                    <TableHead className="w-[10%] px-3 font-bold text-gray-800 text-center">유형</TableHead>
                    <TableHead className="w-[20%] px-3 font-bold text-gray-800 text-center">검색 내용</TableHead>
                    <TableHead className="w-[12%] px-3 text-center font-bold text-gray-800">결과 수</TableHead>
                    <TableHead className="w-[13%] px-3 text-center font-bold text-gray-800">사용 크레딧</TableHead>
                    <TableHead className="w-[13%] px-3 text-center font-bold text-gray-800">반환 크레딧</TableHead>
                    <TableHead className="w-[17%] px-3 font-bold text-gray-800 text-center">검색일시</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searches.map((s: any, idx: number) => {
                    // 플랫폼별 공식 아이콘 정의
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
                              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                            </svg>
                          )
                        default:
                          return <Hash className="w-4 h-4" />
                      }
                    }
                    
                    const platformNames = {
                      youtube: 'YouTube',
                      instagram: 'Instagram', 
                      tiktok: 'TikTok'
                    }
                    
                    // 검색 유형별 정보 정의
                    const getSearchTypeInfo = () => {
                      switch (s.search_type) {
                        case 'profile':
                          return { icon: User, text: '프로필', color: 'text-purple-500' }
                        case 'url':
                          return { icon: LinkIcon, text: 'URL', color: 'text-blue-500' }
                        case 'subtitle_extraction':
                          return { icon: MessageSquare, text: '자막', color: 'text-orange-500' }
                        default:
                          return { icon: Hash, text: '키워드', color: 'text-green-500' }
                      }
                    }

                    const typeInfo = getSearchTypeInfo()
                    const TypeIcon = typeInfo.icon

                    // cancelled 상태여도 실제로는 크레딧이 차감되었으므로 정상 표시
                    const actualCreditsUsed = s.status === 'cancelled' && s.results_count > 0 
                      ? Math.floor((s.results_count / 30) * 100) // 30개당 100크레딧 기준으로 계산
                      : s.credits_used || 0
                    
                    return (
                      <TableRow key={idx} className="hover:bg-gray-50/70 transition-colors">
                        <TableCell className="px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="text-gray-700">
                              {getPlatformIcon(s.platform)}
                            </div>
                            <span className="font-semibold text-gray-800 text-sm">
                              {platformNames[s.platform as keyof typeof platformNames] || s.platform}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <TypeIcon className={`w-3 h-3 ${typeInfo.color}`} />
                            <span className="font-medium text-gray-600 text-xs">{typeInfo.text}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 text-center">
                          <div className="max-w-full text-center">
                            {s.keyword?.startsWith('http') ? (
                              <ExpandableText 
                                text={s.keyword || '내용 없음'} 
                                maxLength={25}
                                className="font-semibold text-gray-800 text-sm"
                              />
                            ) : (
                              <span className="font-semibold text-gray-800 text-sm" title={s.keyword}>
                                {s.keyword || '내용 없음'}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 text-center">
                          <span className="font-semibold text-gray-900 text-sm">
                            {s.status === 'cancelled' || s.status === 'pending' ? (
                              <span className="text-red-600">검색 취소</span>
                            ) : s.results_count ? (
                              `${s.results_count}개`
                            ) : (
                              '-'
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 text-center">
                          <span className="font-semibold text-gray-900 tabular-nums text-sm">
                            {actualCreditsUsed > 0 ? actualCreditsUsed : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 text-center">
                          <span className="font-semibold text-green-600 tabular-nums text-sm">
                            {s.refund_amount > 0 ? `+${s.refund_amount}` : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 text-center">
                          <div className="font-medium text-gray-500 text-sm">
                            {new Date(s.created_at).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          
          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {/* 첫 페이지 */}
                {currentPage > 3 && (
                  <>
                    <Button
                      variant={1 === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      className="h-8 w-8 p-0 text-sm"
                    >
                      1
                    </Button>
                    {currentPage > 4 && <span className="px-2 text-gray-400">...</span>}
                  </>
                )}
                
                {/* 현재 페이지 주변 */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                  if (page > totalPages) return null
                  return (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="h-8 w-8 p-0 text-sm"
                    >
                      {page}
                    </Button>
                  )
                })}
                
                {/* 마지막 페이지 */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="px-2 text-gray-400">...</span>}
                    <Button
                      variant={totalPages === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      className="h-8 w-8 p-0 text-sm"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}