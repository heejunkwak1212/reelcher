import { supabaseBrowser } from '@/lib/supabase/client'

/**
 * 완전한 로그아웃을 수행합니다
 * - Supabase 세션 종료
 * - 로컬 스토리지 정리
 * - 페이지 리디렉션
 */
export async function performCompleteLogout() {
  try {
    const supabase = supabaseBrowser()
    
    // Supabase 로그아웃
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('로그아웃 오류:', error)
      return { success: false, error: error.message }
    }
    
    // 로컬 스토리지 정리 (필요한 경우)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('supabase.auth.token')
      sessionStorage.clear()
    }
    
    console.log('✅ 로그아웃 성공')
    return { success: true }
    
  } catch (error) {
    console.error('로그아웃 예외:', error)
    return { success: false, error: '로그아웃 중 오류가 발생했습니다' }
  }
}