import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'

const schema = z.object({
  type: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(5),
})

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer()
    
    // 현재 로그인한 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = schema.parse(body)
    
    // contacts 테이블에 문의 저장
    const { error: insertError } = await supabase
      .from('contacts')
      .insert({
        user_id: user.id,
        subject: parsed.type, // type을 subject로 사용
        message: parsed.message,
        reply_email: parsed.email, // 답변받을 이메일 저장
        status: 'pending'
      })

    if (insertError) {
      console.error('Contact 저장 오류:', insertError)
      return NextResponse.json({ error: '문의 저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('API 오류:', e)
    return NextResponse.json({ error: e?.message || 'Invalid request' }, { status: 400 })
  }
}


