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
      const res = await fetch(`/api/admin/users?page=${page}&pageSize=50`, { cache: 'no-store' })
      if (!res.ok) throw new Error('load failed')
      return res.json() as Promise<{ 
        items: any[]; 
        profiles: any[]; 
        credits: any[]; 
        searchStats: Record<string, { totalCost: number; searchCount: number }>; 
        total: number 
      }>
    },
  })
  const rows = q.data?.items || []
  const profiles = q.data?.profiles || []
  const credits = q.data?.credits || []
  const searchStats = q.data?.searchStats || {}
  
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
  
  // Helper functions
  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId)
  const getCredits = (userId: string) => credits.find(c => c.user_id === userId)
  const getSearchStats = (userId: string) => searchStats[userId] || { totalCost: 0, searchCount: 0 }
  
  const handleDeleteUser = (userId: string, userEmail: string) => {
    if (confirm(`정말로 사용자 "${userEmail}"를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      setDeletingUserId(userId)
      deleteUserMutation.mutate(userId)
    }
  }
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">사용자 관리</h1>
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="block text-sm mb-1">관리자로 승격할 이메일</span>
          <input className="w-full border border-gray-200 rounded px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="un030303@naver.com" />
        </label>
        <button className="px-3 py-2 border border-gray-200 rounded bg-black text-white" disabled={!email.trim() || promoting} onClick={async()=>{
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
      <div className="text-sm text-neutral-600">총 {q.data?.total ?? 0}명</div>
      <div className="overflow-x-auto border border-gray-200 rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-900 text-white">
            <tr>
              <th className="p-3 border border-gray-700 w-16 text-xs">ID</th>
              <th className="p-3 border border-gray-700">Email</th>
              <th className="p-3 border border-gray-700 w-20">이름</th>
              <th className="p-3 border border-gray-700 w-28">전화번호</th>
              <th className="p-3 border border-gray-700 w-20">인증</th>
              <th className="p-3 border border-gray-700 w-16">잔액</th>
              <th className="p-3 border border-gray-700 w-20">사용량</th>
              <th className="p-3 border border-gray-700 w-16">검색수</th>
              <th className="p-3 border border-gray-700 w-24">Created</th>
              <th className="p-3 border border-gray-700 w-20">액션</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const profile = getProfile(u.id)
              const credit = getCredits(u.id)
              const stats = getSearchStats(u.id)
              return (
                <tr key={u.id} className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                  <td className="p-3 border border-gray-200 whitespace-nowrap text-xs font-mono">
                    {u.id.slice(-8)}
                  </td>
                  <td className="p-3 border border-gray-200">{u.email || '-'}</td>
                  <td className="p-3 border border-gray-200">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-gray-400" />
                      <span className="text-xs">{profile?.display_name || '-'}</span>
                    </div>
                  </td>
                  <td className="p-3 border border-gray-200">
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-gray-400" />
                      <span className="text-xs">{profile?.phone_number || '-'}</span>
                    </div>
                  </td>
                  <td className="p-3 border border-gray-200 text-center">
                    {profile?.is_verified ? (
                      <ShieldCheck className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <Shield className="h-4 w-4 text-gray-400 mx-auto" />
                    )}
                  </td>
                  <td className="p-3 border border-gray-200 text-right text-xs">
                    {(credit?.balance || 0).toLocaleString()}
                  </td>
                  <td className="p-3 border border-gray-200 text-right font-medium text-xs">
                    {stats.totalCost.toLocaleString()}
                  </td>
                  <td className="p-3 border border-gray-200 text-center text-xs">
                    {stats.searchCount}
                  </td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td className="p-3 border border-gray-200 text-center">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteUser(u.id, u.email)}
                      disabled={deletingUserId === u.id}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button className="px-2 py-1 border border-gray-200 rounded hover:border border-gray-200-gray-300 transition-colors" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>이전</button>
        <span className="text-sm">{page}</span>
        <button className="px-2 py-1 border border-gray-200 rounded hover:border border-gray-200-gray-300 transition-colors" onClick={()=>setPage(p=>p+1)} disabled={(rows.length||0) < 50}>다음</button>
      </div>
    </div>
  )
}


