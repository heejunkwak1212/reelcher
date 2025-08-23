"use client"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Trash2, Shield, ShieldCheck, Phone, User } from 'lucide-react'

export default function AdminUsers() {
  const [page, setPage] = useState(1)
  const [email, setEmail] = useState('')
  const [promoting, setPromoting] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  
  const q = useQuery({
    queryKey: ['admin-users', page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users`, { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
      if (!res.ok) throw new Error('load failed')
      return res.json() as Promise<{ 
        users: any[]; 
        totalUsers: number;
      }>
    },
  })
  
  const users = q.data?.users || []
  
  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete user')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: '사용자 삭제 완료',
        description: '사용자가 성공적으로 삭제되었습니다.',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setDeletingUserId(null)
    },
    onError: (error: Error) => {
      toast({
        title: '삭제 실패',
        description: error.message,
        variant: 'destructive',
      })
      setDeletingUserId(null)
    }
  })
  
  const handleDeleteUser = (userId: string, userEmail: string) => {
    if (confirm(`정말로 사용자 "${userEmail}"를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      setDeletingUserId(userId)
      deleteUserMutation.mutate(userId)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-lg font-medium text-gray-900">사용자 관리</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="block text-sm mb-1 text-gray-700">관리자로 승격할 이메일</span>
            <input className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com" />
          </label>
          <button className="px-4 py-2 border border-gray-200 rounded-md bg-white text-gray-900 text-sm hover:bg-gray-50 transition-colors" disabled={!email.trim() || promoting} onClick={async()=>{
            if (!email.trim()) return
            setPromoting(true)
            try {
              const res = await fetch('/api/admin/promote', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ email: email.trim() }) })
              const j = await res.json().catch(()=>({}))
              if (!res.ok) throw new Error(j?.error || '승격 실패')
              alert('관리자로 설정되었습니다')
            } catch (e) { alert((e as Error).message) } finally { setPromoting(false) }
          }}>관리자 추가</button>
        </div>
      </div>
      <div className="text-sm text-gray-600">총 {q.data?.totalUsers ?? 0}명</div>
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3 text-left w-16 text-xs font-medium text-gray-700">ID</th>
                <th className="p-3 text-left font-medium text-gray-700">Email</th>
                <th className="p-3 text-left w-20 font-medium text-gray-700">이름</th>
                <th className="p-3 text-left w-28 font-medium text-gray-700">전화번호</th>
                <th className="p-3 text-left w-20 font-medium text-gray-700">인증</th>
                <th className="p-3 text-left w-16 font-medium text-gray-700">잔액</th>
                <th className="p-3 text-left w-20 font-medium text-gray-700">사용 크레딧</th>
                <th className="p-3 text-left w-16 font-medium text-gray-700">검색수</th>
                <th className="p-3 text-left w-24 font-medium text-gray-700">Created</th>
                <th className="p-3 text-left w-20 font-medium text-gray-700">액션</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                return (
                  <tr key={u.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 whitespace-nowrap text-xs font-mono text-gray-500">
                      {u.user_id.slice(-8)}
                    </td>
                    <td className="p-3 text-gray-900">{u.email || u.user_id || '-'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-600">{u.display_name || '-'}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-600">-</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <Shield className="h-4 w-4 text-gray-400 mx-auto" />
                    </td>
                    <td className="p-3 text-right text-xs text-gray-600">
                      {(u.credits_balance || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-medium text-xs text-gray-900">
                      {(u.month_credits_used || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-center text-xs text-gray-600">
                      {u.total_searches || 0}
                    </td>
                    <td className="p-3 whitespace-nowrap text-xs text-gray-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteUser(u.user_id, u.user_id)}
                        disabled={deletingUserId === u.user_id}
                        className="h-7 w-7 p-0 border border-gray-200 rounded-md bg-white hover:bg-red-50 hover:border-red-200 transition-colors flex items-center justify-center"
                      >
                        <Trash2 className="h-3 w-3 text-gray-500 hover:text-red-500" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-sm hover:bg-gray-50 transition-colors" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>이전</button>
        <span className="text-sm text-gray-600 px-2">{page}</span>
        <button className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-sm hover:bg-gray-50 transition-colors" onClick={()=>setPage(p=>p+1)} disabled={(users.length||0) < 50}>다음</button>
      </div>
    </div>
  )
}