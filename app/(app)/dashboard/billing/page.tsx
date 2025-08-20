import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import CancelSubscriptionButton from '@/components/billing/CancelSubscriptionButton'

export const runtime = 'nodejs'

export default async function BillingPage() {
  const ssr = await supabaseServer()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return null
  const { data: prof } = await ssr.from('profiles').select('plan').eq('user_id', user.id).single()
  const { data: cr } = await ssr.from('credits').select('balance').eq('user_id', user.id).single()
  const plan = (prof?.plan || 'free') as string
  const balance = Number(cr?.balance || 0)
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">구독 관리</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500">현재 플랜</div>
          <div className="text-xl font-semibold capitalize">{plan}</div>
          <div className="mt-4 flex gap-2">
            <Link className="px-3 py-2 rounded-md bg-neutral-900 text-white text-sm" href="/pricing">플랜 변경</Link>
            <CancelSubscriptionButton />
          </div>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500">크레딧 잔액</div>
          <div className="text-xl font-semibold">{balance.toLocaleString()}</div>
        </div>
      </div>
      <div className="text-xs text-neutral-500">
        구독 취소 시 자동 결제가 즉시 중지되며, 현재 결제 주기의 종료일(다음 결제 예정일)까지 해당 플랜 혜택이 유지됩니다. 이후에는 FREE 플랜으로 전환됩니다.
      </div>
    </div>
  )
}


