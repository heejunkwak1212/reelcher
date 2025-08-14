import { supabaseServer } from '@/lib/supabase/server'

export default async function HistoryPage() {
  const ssr = supabaseServer()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return null
  const { data: searches } = await ssr.from('searches').select('created_at, keyword, requested, returned, cost').order('created_at', { ascending: false }).limit(50)
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">사용 이력</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">일시</th>
              <th className="py-2 pr-4">키워드</th>
              <th className="py-2 pr-4">요청</th>
              <th className="py-2 pr-4">반환</th>
              <th className="py-2 pr-4">차감</th>
            </tr>
          </thead>
          <tbody>
            {(searches || []).map((s: any, idx: number) => (
              <tr key={idx} className="border-b last:border-b-0 hover:bg-neutral-50">
                <td className="py-2 pr-4 whitespace-nowrap">{new Date(s.created_at).toLocaleString()}</td>
                <td className="py-2 pr-4">#{s.keyword}</td>
                <td className="py-2 pr-4">{Number(s.requested || 0).toLocaleString()}</td>
                <td className="py-2 pr-4">{Number(s.returned || 0).toLocaleString()}</td>
                <td className="py-2 pr-4">{Number(s.cost || 0).toLocaleString()}</td>
              </tr>
            ))}
            {(!searches || searches.length === 0) && (
              <tr><td className="py-6 text-neutral-500" colSpan={5}>이력이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}


