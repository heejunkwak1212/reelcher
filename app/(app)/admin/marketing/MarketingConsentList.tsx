'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Mail, User, Calendar } from 'lucide-react'

interface MarketingUser {
  user_id: string
  display_name: string
  email: string
  marketing_consent: boolean
  plan: string
  created_at: string
  onboarding_completed: boolean
}

interface MarketingConsentListProps {
  searchParams: { page?: string }
}

export default function MarketingConsentList({ searchParams }: MarketingConsentListProps) {
  const [users, setUsers] = useState<MarketingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  
  const currentPage = parseInt(searchParams.page || '1', 10)
  const itemsPerPage = 10
  const totalPages = Math.ceil(totalCount / itemsPerPage)

  useEffect(() => {
    fetchMarketingUsers()
  }, [currentPage])

  const fetchMarketingUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/marketing-users?page=${currentPage}&limit=${itemsPerPage}`)
      
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
        setTotalCount(data.total || 0)
      } else {
        console.error('마케팅 수신동의 사용자 조회 실패')
      }
    } catch (error) {
      console.error('마케팅 수신동의 사용자 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'free': return 'secondary'
      case 'starter': return 'default'
      case 'pro': return 'outline'
      case 'business': return 'destructive'
      default: return 'secondary'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            마케팅 수신동의 통계
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {totalCount}명
          </div>
          <p className="text-sm text-gray-600 mt-1">
            총 마케팅 수신동의 사용자 수
          </p>
        </CardContent>
      </Card>

      {/* 사용자 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              마케팅 수신동의한 사용자가 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.user_id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            {user.display_name || '이름 없음'}
                          </span>
                        </div>
                        <Badge variant={getPlanBadgeColor(user.plan)}>
                          {user.plan.toUpperCase()}
                        </Badge>
                        {user.marketing_consent && (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            마케팅 동의
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span>{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>가입일: {formatDate(user.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-600">
                전체 {totalCount}명 중 {(currentPage - 1) * itemsPerPage + 1}-
                {Math.min(currentPage * itemsPerPage, totalCount)}명 표시
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search)
                    params.set('page', String(currentPage - 1))
                    window.location.search = params.toString()
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  이전
                </Button>
                
                <span className="text-sm">
                  {currentPage} / {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search)
                    params.set('page', String(currentPage + 1))
                    window.location.search = params.toString()
                  }}
                >
                  다음
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
