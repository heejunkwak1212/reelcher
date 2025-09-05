import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseService } from '@/lib/supabase/service';
import { encryptApiKey, decryptApiKey } from '@/lib/crypto';
import { validateYouTubeApiKey, getValidationErrorMessage } from '@/lib/youtube-api-validator';
import { z } from 'zod';

// API 키 저장/업데이트 스키마
const saveApiKeySchema = z.object({
  platform: z.enum(['youtube']),
  apiKey: z.string().min(1, 'API 키를 입력해주세요'),
  keyName: z.string().optional(),
  validateKey: z.boolean().default(true), // 저장 시 검증 여부
});

// API 키 조회 스키마
const getApiKeySchema = z.object({
  platform: z.enum(['youtube']),
});

// GET: 사용자의 API 키 목록 조회 (복호화된 상태로)
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const url = new URL(request.url);
    const platform = url.searchParams.get('platform');
    
    if (!platform) {
      return NextResponse.json({ error: 'platform 파라미터가 필요합니다' }, { status: 400 });
    }

    const { platform: validatedPlatform } = getApiKeySchema.parse({ platform });

    // 사용자의 API 키 조회 (모든 키)
    const { data: apiKeys, error: fetchError } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', validatedPlatform)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('API 키 조회 실패:', fetchError);
      return NextResponse.json({ error: 'API 키 조회에 실패했습니다' }, { status: 500 });
    }

    // 암호화된 API 키들을 복호화하여 반환
    const decryptedApiKeys = apiKeys?.map(key => {
      try {
        let decryptedKey = '';
        
        if (key.encrypted_api_key && key.encryption_salt) {
          // 새로운 암호화 방식
          decryptedKey = decryptApiKey(key.encrypted_api_key, key.encryption_salt, user.id);
        } else if (key.api_key) {
          // 기존 평문 방식 (마이그레이션 필요)
          decryptedKey = key.api_key;
        }

        return {
          id: key.id,
          platform: key.platform,
          apiKey: decryptedKey,
          keyName: key.key_name,
          isActive: key.is_active,
          validationStatus: key.validation_status,
          validationErrorMessage: key.validation_error_message,
          lastValidatedAt: key.last_validated_at,
          createdAt: key.created_at,
          updatedAt: key.updated_at,
        };
      } catch (decryptError) {
        console.error('API 키 복호화 실패:', decryptError);
        return {
          id: key.id,
          platform: key.platform,
          apiKey: '', // 복호화 실패 시 빈 문자열
          keyName: key.key_name,
          isActive: false, // 복호화 실패한 키는 비활성화
          validationStatus: 'invalid',
          validationErrorMessage: '복호화에 실패했습니다',
          lastValidatedAt: key.last_validated_at,
          createdAt: key.created_at,
          updatedAt: key.updated_at,
        };
      }
    }) || [];

    return NextResponse.json({
      success: true,
      apiKeys: decryptedApiKeys,
    });

  } catch (error) {
    console.error('API 키 조회 중 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// POST: API 키 저장/업데이트 (암호화하여 저장)
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const supabaseAdmin = supabaseService();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { platform, apiKey, keyName, validateKey } = saveApiKeySchema.parse(body);

    // API 키 검증 (요청된 경우)
    let validationStatus = 'pending';
    let validationErrorMessage = null;
    
    if (validateKey) {
      console.log('🔍 API 키 검증 시작');
      const validationResult = await validateYouTubeApiKey(apiKey);
      
      if (validationResult.isValid) {
        validationStatus = 'valid';
        console.log('✅ API 키 검증 성공');
      } else {
        validationStatus = validationResult.error || 'invalid';
        validationErrorMessage = getValidationErrorMessage(validationResult);
        console.log('❌ API 키 검증 실패:', validationErrorMessage);
        
        // 검증 실패 시에도 저장은 진행하되, 상태를 기록
      }
    }

    // API 키 암호화
    const { encryptedKey, salt } = encryptApiKey(apiKey, user.id);

    const now = new Date().toISOString();

    // 기존 활성 키들을 모두 비활성화
    await supabaseAdmin
      .from('user_api_keys')
      .update({ is_active: false, updated_at: now })
      .eq('user_id', user.id)
      .eq('platform', platform)
      .eq('is_active', true);

    // 새 키 생성 (새 키만 활성화)
    const { error: insertError } = await supabaseAdmin
      .from('user_api_keys')
      .insert({
        user_id: user.id,
        platform: platform,
        encrypted_api_key: encryptedKey,
        encryption_salt: salt,
        key_name: keyName,
        is_active: true,
        validation_status: validationStatus,
        validation_error_message: validationErrorMessage,
        last_validated_at: validateKey ? now : null,
        created_at: now,
        updated_at: now,
      });

    if (insertError) {
      console.error('API 키 생성 실패:', insertError);
      return NextResponse.json({ error: 'API 키 저장에 실패했습니다' }, { status: 500 });
    }

    console.log('✅ API 키 생성 완료');

    return NextResponse.json({
      success: true,
      message: 'API 키가 성공적으로 저장되었습니다',
      validation: {
        status: validationStatus,
        errorMessage: validationErrorMessage,
        isValid: validationStatus === 'valid',
      },
    });

  } catch (error) {
    console.error('API 키 저장 중 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// PUT: API 키 활성화/비활성화
const updateApiKeySchema = z.object({
  id: z.string().uuid('유효하지 않은 ID 형식입니다'),
  isActive: z.boolean(),
});

export async function PUT(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const supabaseAdmin = supabaseService();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { id, isActive } = updateApiKeySchema.parse(body);

    // 해당 API 키가 사용자 소유인지 확인
    const { data: existingKey, error: fetchError } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingKey) {
      return NextResponse.json({ error: 'API 키를 찾을 수 없습니다' }, { status: 404 });
    }

    if (isActive) {
      // 다른 키들을 비활성화하고 이 키를 활성화
      await supabaseAdmin
        .from('user_api_keys')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('platform', existingKey.platform);
    }

    // 해당 키의 활성화 상태 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('user_api_keys')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('API 키 업데이트 실패:', updateError);
      return NextResponse.json({ error: 'API 키 업데이트에 실패했습니다' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `API 키가 성공적으로 ${isActive ? '활성화' : '비활성화'}되었습니다`,
    });

  } catch (error) {
    console.error('API 키 업데이트 중 오류:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// DELETE: API 키 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const supabaseAdmin = supabaseService();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { id: keyId } = body;

    if (!keyId) {
      return NextResponse.json({ error: 'id 파라미터가 필요합니다' }, { status: 400 });
    }

    // 소유권 확인 후 실제 삭제
    const { error: deleteError } = await supabaseAdmin
      .from('user_api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('API 키 삭제 실패:', deleteError);
      return NextResponse.json({ error: 'API 키 삭제에 실패했습니다' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'API 키가 성공적으로 삭제되었습니다',
    });

  } catch (error) {
    console.error('API 키 삭제 중 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}