"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Contact {
  id: string
  user_id: string
  subject: string
  message: string
  status: string
  admin_response?: string
  created_at: string
  updated_at: string
  responded_at?: string
  reply_email?: string
  profiles?: {
    display_name?: string
    email?: string
  } | null
}

interface ContactListProps {
  contacts: Contact[]
  currentPage: number
  totalPages: number
}

export default function ContactList({ contacts, currentPage, totalPages }: ContactListProps) {
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set())
  
  console.log('📧 ContactList contacts:', contacts)

  const toggleExpanded = (contactId: string) => {
    const newExpanded = new Set(expandedContacts)
    if (newExpanded.has(contactId)) {
      newExpanded.delete(contactId)
    } else {
      newExpanded.add(contactId)
    }
    setExpandedContacts(newExpanded)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: '대기중', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      in_progress: { label: '처리중', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      resolved: { label: '해결됨', className: 'bg-green-100 text-green-800 border-green-200' },
      closed: { label: '완료', className: 'bg-gray-100 text-gray-800 border-gray-200' }
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>
  }

  // 페이지네이션 컴포넌트
  const Pagination = () => {
    if (totalPages <= 1) return null

    const getPageNumbers = () => {
      const pages = []
      const maxVisible = 5
      
      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        if (currentPage <= 3) {
          for (let i = 1; i <= 4; i++) pages.push(i)
          pages.push('...')
          pages.push(totalPages)
        } else if (currentPage >= totalPages - 2) {
          pages.push(1)
          pages.push('...')
          for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i)
        } else {
          pages.push(1)
          pages.push('...')
          for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
          pages.push('...')
          pages.push(totalPages)
        }
      }
      
      return pages
    }

    return (
      <div className="flex justify-center items-center gap-2 mt-8">
        <Link href={`/admin/contacts?page=${currentPage - 1}`}>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === 1}
            className="disabled:opacity-50 disabled:cursor-not-allowed"
          >
            이전
          </Button>
        </Link>
        
        {getPageNumbers().map((page, index) => 
          page === '...' ? (
            <span key={index} className="px-2 text-gray-500">...</span>
          ) : (
            <Link key={page} href={`/admin/contacts?page=${page}`}>
              <Button 
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                className="min-w-[40px]"
              >
                {page}
              </Button>
            </Link>
          )
        )}
        
        <Link href={`/admin/contacts?page=${currentPage + 1}`}>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === totalPages}
            className="disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다음
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4">
        {contacts && contacts.length > 0 ? (
          contacts.map((contact: Contact) => {
            const isExpanded = expandedContacts.has(contact.id)
            return (
              <Card key={contact.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-medium text-gray-900 mb-3">
                        {contact.subject}
                      </CardTitle>
                      <div className="space-y-2">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>
                            <span className="font-medium text-gray-500">가입 이메일:</span>{' '}
                            <span className="text-blue-600">{contact.profiles?.email || '-'}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>
                            <span className="font-medium text-gray-500">답변받을 이메일:</span>{' '}
                            <span className="text-green-600">{contact.reply_email || '-'}</span>
                          </span>
                          <span className="text-gray-300">|</span>
                          <span className="text-gray-500">{new Date(contact.created_at).toLocaleString('ko-KR')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(contact.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-700">문의 내용</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpanded(contact.id)}
                        className="text-xs"
                      >
                        {isExpanded ? '접기' : '상세보기'}
                      </Button>
                    </div>
                    
                    {isExpanded ? (
                      <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-lg border whitespace-pre-wrap">
                        {contact.message}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded border line-clamp-2">
                        {contact.message.length > 100 ? contact.message.substring(0, 100) + '...' : contact.message}
                      </p>
                    )}
                    
                    {contact.admin_response && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          관리자 응답
                          {contact.responded_at && (
                            <span className="ml-2 text-xs text-gray-500 font-normal">
                              ({new Date(contact.responded_at).toLocaleString('ko-KR')})
                            </span>
                          )}
                        </h4>
                        <p className="text-sm text-gray-600 leading-relaxed bg-blue-50 p-3 rounded border border-blue-200 whitespace-pre-wrap">
                          {contact.admin_response}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card className="border border-gray-200">
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-lg font-medium mb-2">문의가 없습니다</p>
                <p className="text-sm">사용자 문의가 등록되면 여기에 표시됩니다.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      <Pagination />
    </>
  )
}
