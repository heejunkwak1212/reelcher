import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { validateYouTubeApiKey, getValidationErrorMessage } from '@/lib/youtube-api-validator';
import { z } from 'zod';

// API 키 검증 스키마
const validateApiKeySchema = z.object({
  platform: z.enum(['youtube']),
  apiKey: z.string().min(1, 'API 키를 입력해주세요'),
});

// POST: API 키 유효성 검증 (저장하지 않고 검증만)
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { platform, apiKey } = validateApiKeySchema.parse(body);

    console.log(`🔍 ${platform} API 키 검증 요청 - 사용자: ${user.id}`);

    // YouTube API 키 검증
    if (platform === 'youtube') {
      const validationResult = await validateYouTubeApiKey(apiKey);
      
      if (validationResult.isValid) {
        console.log('✅ YouTube API 키 검증 성공');
        return NextResponse.json({
          success: true,
          isValid: true,
          message: 'API 키가 유효합니다',
        });
      } else {
        const errorMessage = getValidationErrorMessage(validationResult);
        console.log('❌ YouTube API 키 검증 실패:', validationResult.error, errorMessage);
        
        return NextResponse.json({
          success: true,
          isValid: false,
          error: validationResult.error,
          message: errorMessage,
        });
      }
    }

    return NextResponse.json(
      { error: '지원하지 않는 플랫폼입니다' },
      { status: 400 }
    );

  } catch (error) {
    console.error('API 키 검증 중 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
