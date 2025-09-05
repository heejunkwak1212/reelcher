import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import ContactList from './ContactList'

export const dynamic = 'force-dynamic'

export default async function AdminContactsPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const ssr = await supabaseServer()
  
  // 관리자 권한 확인
  const { data: { user }, error: authError } = await ssr.auth.getUser()
  if (authError || !user) {
    throw new Error('인증 실패')
  }

  const { data: profile } = await ssr
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('관리자 권한 필요')
  }

  // 서비스 역할로 모든 데이터 조회 (RLS 우회)
  const supabase = supabaseService()
  
  // 페이지네이션 설정
  const currentPage = Number(searchParams.page) || 1
  const itemsPerPage = 10
  const offset = (currentPage - 1) * itemsPerPage

  // 전체 문의 개수 조회
  const { count: totalCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })

  // contacts 테이블에서 문의 목록 가져오기 (페이지네이션 적용)
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select(`
      id,
      user_id,
      subject,
      message,
      status,
      admin_response,
      created_at,
      updated_at,
      responded_at,
      reply_email
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + itemsPerPage - 1)

  // 각 contact의 사용자 정보를 별도로 조회
  let contactsWithProfiles: any[] = []
  if (contacts && contacts.length > 0) {
    const userIds = [...new Set(contacts.map(c => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, email')
      .in('user_id', userIds)

    contactsWithProfiles = contacts.map(contact => ({
      ...contact,
      profiles: profiles?.find(p => p.user_id === contact.user_id) || null
    }))
    
    console.log('🔍 Contacts with profiles:', contactsWithProfiles)
  }

  const totalPages = Math.ceil((totalCount || 0) / itemsPerPage)

  if (error) {
    console.error('Contact 조회 오류:', error)
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">문의 관리</h1>
            <p className="text-gray-600">사용자 문의사항을 확인하고 관리합니다.</p>
          </div>
          <div className="text-sm text-gray-500">
            총 {totalCount}개 문의 | {currentPage}/{totalPages} 페이지
          </div>
        </div>
      </div>

      <ContactList 
        contacts={contactsWithProfiles} 
        currentPage={currentPage}
        totalPages={totalPages}
      />
    </main>
  )
}


