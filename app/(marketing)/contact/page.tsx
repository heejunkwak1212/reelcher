import { db } from '@/db'
import { pages } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { supabaseServer } from '@/lib/supabase/server'
import InlineEditor from '@/components/admin/InlineEditor'
import ContactForm from '@/components/layout/ContactForm'

export const runtime = 'nodejs'

export default async function ContactPage() {
  const row = (await db.select().from(pages).where(eq(pages.slug, 'contact')).limit(1))[0]
  const ssr = await supabaseServer()
  const { data: { user } } = await ssr.auth.getUser().catch(()=>({ data:{ user:null }} as any))
  let isAdmin = false
  if (user) {
    const { data } = await ssr.from('profiles').select('role').eq('user_id', user.id).single()
    isAdmin = data?.role === 'admin'
  }
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <h1 className="text-2xl font-bold">문의</h1>
      <ContactForm />
      {/* 문의 페이지는 에디터 안내문을 표시하지 않습니다. */}
      {/* 문의 페이지에서는 에디터 UI를 숨깁니다 */}
    </div>
  )
}


