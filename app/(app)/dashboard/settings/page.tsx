import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export default async function SettingsPage() {
  const ssr = supabaseServer()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return null
  const { data: prof } = await ssr.from('profiles').select('display_name, how_found, plan').eq('user_id', user.id).single()
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">설정</h1>
      <div className="border rounded-lg p-4 space-y-2 text-sm">
        <div className="text-neutral-500">닉네임</div>
        <div className="font-medium">{(prof as any)?.display_name || '-'}</div>
        <div className="text-neutral-500 mt-4">유입 경로</div>
        <div className="font-medium">{(prof as any)?.how_found || '-'}</div>
        <div className="text-neutral-500 mt-4">플랜</div>
        <div className="font-medium capitalize">{(prof as any)?.plan || 'free'}</div>
      </div>
    </div>
  )
}


