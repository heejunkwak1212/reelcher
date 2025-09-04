"use client"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from '@/hooks/use-toast'

export default function AdminCredits() {
  const queryClient = useQueryClient()
  
  const q = useQuery({
    queryKey: ['admin-credits'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users?page=1&pageSize=200', { cache: 'no-store' })
      if (!res.ok) throw new Error('load failed')
      return res.json() as Promise<{ users: any[]; totalUsers: number }>
    },
  })
  
  const users = q.data?.users || []
  const [email, setEmail] = useState('')
  const [delta, setDelta] = useState(1000)
  const [action, setAction] = useState<'charge' | 'deduct'>('charge')
  
  const creditMutation = useMutation({
    mutationFn: async ({ email, creditDelta }: { email: string; creditDelta: number }) => {
      const res = await fetch('/api/admin/users', { 
        method: 'PUT', 
        headers: { 'content-type': 'application/json' }, 
        body: JSON.stringify({ email, creditDelta }) 
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '처리 실패')
      }
      return res.json()
    },
    onSuccess: (data, { creditDelta }) => {
      const actionText = creditDelta > 0 ? '충전' : '차감'
      toast({
        title: `크레딧 ${actionText} 완료`,
        description: `${Math.abs(creditDelta).toLocaleString()} 크레딧이 ${actionText}되었습니다.`,
      })
      setEmail('')
      queryClient.invalidateQueries({ queryKey: ['admin-credits'] })
    },
    onError: (error: Error) => {
      toast({
        title: '처리 실패',
        description: error.message,
        variant: 'destructive',
      })
    }
  })
  
  const handleCreditAction = () => {
    if (!email || !delta) {
      toast({
        title: '입력 오류',
        description: '이메일과 크레딧을 입력하세요.',
        variant: 'destructive',
      })
      return
    }
    
    const creditDelta = action === 'charge' ? delta : -delta
    creditMutation.mutate({ email, creditDelta })
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">크레딧 관리</h1>
      
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <h2 className="text-sm font-medium text-gray-900 mb-3">크레딧 충전/차감</h2>
        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="block text-xs mb-1 text-gray-600">이메일</span>
            <input 
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              value={email} 
              onChange={e=>setEmail(e.target.value)} 
              placeholder="user@example.com" 
            />
          </label>
          <label>
            <span className="block text-xs mb-1 text-gray-600">크레딧 수량</span>
            <input 
              type="number" 
              className="w-32 border border-gray-200 rounded px-3 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              value={delta} 
              onChange={e=>setDelta(Number(e.target.value||'0'))} 
              min="1"
            />
          </label>
          <div className="flex border border-gray-200 rounded overflow-hidden">
            <button 
              className={`px-3 py-2 text-sm transition-colors ${action === 'charge' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setAction('charge')}
            >
              충전
            </button>
            <button 
              className={`px-3 py-2 text-sm transition-colors ${action === 'deduct' ? 'bg-red-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setAction('deduct')}
            >
              차감
            </button>
          </div>
          <button 
            className={`px-4 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50 ${
              action === 'charge' 
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            onClick={handleCreditAction}
            disabled={creditMutation.isPending}
          >
            {creditMutation.isPending ? '처리중...' : (action === 'charge' ? '충전 실행' : '차감 실행')}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left font-medium text-gray-700 border-b border-gray-200">사용자</th>
                <th className="p-3 text-right font-medium text-gray-700 border-b border-gray-200">잔액</th>
                <th className="p-3 text-right font-medium text-gray-700 border-b border-gray-200">예약</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.user_id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 border-b border-gray-100 whitespace-nowrap">
                    <div className="text-gray-900">
                      {user.email || user.display_name || user.user_id}
                    </div>
                  </td>
                  <td className="p-3 border-b border-gray-100 text-right font-medium">
                    {(user.credits_balance ?? 0).toLocaleString()}
                  </td>
                  <td className="p-3 border-b border-gray-100 text-right text-gray-600">
                    {(user.credits_reserved ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}