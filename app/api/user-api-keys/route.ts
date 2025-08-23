import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase/service'
import { supabaseServer } from '@/lib/supabase/server'
import { z } from 'zod'

const apiKeySchema = z.object({
  platform: z.enum(['youtube', 'tiktok']),
  apiKey: z.string().min(1),
  keyName: z.string().optional(),
})

const updateApiKeySchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
  keyName: z.string().optional(),
})

const deleteApiKeySchema = z.object({
  id: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const platform = url.searchParams.get('platform') || 'youtube'

    const svc = supabaseService()
    const { data: apiKeys, error } = await svc
      .from('user_api_keys')
      .select('id, platform, api_key, key_name, is_active, created_at')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('API 키 조회 오류:', error)
      return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
    }

    return NextResponse.json({ apiKeys: apiKeys || [] })
  } catch (error) {
    console.error('API 키 GET 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = apiKeySchema.parse(body)

    const svc = supabaseService()
    
    // 기존 활성 키가 있으면 비활성화
    if (validatedData.platform === 'youtube') {
      await svc
        .from('user_api_keys')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('platform', validatedData.platform)
        .eq('is_active', true)
    }

    // 새 API 키 추가
    const { data, error } = await svc
      .from('user_api_keys')
      .insert({
        user_id: user.id,
        platform: validatedData.platform,
        api_key: validatedData.apiKey,
        key_name: validatedData.keyName,
        is_active: true, // 새로 추가된 키는 활성화
      })
      .select()
      .single()

    if (error) {
      console.error('API 키 저장 오류:', error)
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      apiKey: data,
      message: 'API 키가 저장되었습니다.' 
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    console.error('API 키 POST 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateApiKeySchema.parse(body)

    const svc = supabaseService()
    
    // 활성화하는 경우, 다른 키들 비활성화
    if (validatedData.isActive === true) {
      // 먼저 해당 키의 플랫폼을 확인
      const { data: keyData } = await svc
        .from('user_api_keys')
        .select('platform')
        .eq('id', validatedData.id)
        .eq('user_id', user.id)
        .single()

      if (keyData) {
        await svc
          .from('user_api_keys')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('platform', keyData.platform)
          .neq('id', validatedData.id)
      }
    }

    const updateData: any = {}
    if (validatedData.isActive !== undefined) updateData.is_active = validatedData.isActive
    if (validatedData.keyName !== undefined) updateData.key_name = validatedData.keyName
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await svc
      .from('user_api_keys')
      .update(updateData)
      .eq('id', validatedData.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('API 키 업데이트 오류:', error)
      return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      apiKey: data,
      message: 'API 키가 업데이트되었습니다.' 
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    console.error('API 키 PUT 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = deleteApiKeySchema.parse(body)

    const svc = supabaseService()
    const { error } = await svc
      .from('user_api_keys')
      .delete()
      .eq('id', validatedData.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('API 키 삭제 오류:', error)
      return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'API 키가 삭제되었습니다.' 
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    console.error('API 키 DELETE 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

