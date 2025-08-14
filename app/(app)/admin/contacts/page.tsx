import { db } from '@/db'
import { inquiries } from '@/db/schema'

export const dynamic = 'force-dynamic'

export default async function AdminContactsPage() {
  const rows = await db.select().from(inquiries).orderBy(inquiries.createdAt)
  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-4">문의 목록</h1>
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left p-3 border-b">ID</th>
              <th className="text-left p-3 border-b">유형</th>
              <th className="text-left p-3 border-b">이메일</th>
              <th className="text-left p-3 border-b">내용</th>
              <th className="text-left p-3 border-b">생성일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={String((r as any).id)} className="odd:bg-white even:bg-neutral-50">
                <td className="p-3 border-b">{(r as any).id}</td>
                <td className="p-3 border-b">{(r as any).type}</td>
                <td className="p-3 border-b">{(r as any).email}</td>
                <td className="p-3 border-b max-w-[480px] truncate" title={(r as any).message}>{(r as any).message}</td>
                <td className="p-3 border-b">{new Date((r as any).createdAt as any).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}


