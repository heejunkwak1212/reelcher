'use client'

import { useCallback, useEffect, useRef } from 'react'

interface UseDashboardRefreshOptions {
  onRefresh: () => void
  throttleMs?: number
  enableStorageListener?: boolean
}

/**
 * 대시보드 자동 새로고침 최적화 훅
 * - 이벤트 기반 업데이트 (탭 포커스, 가시성 변경)
 * - 중복 호출 방지 (throttling)
 * - localStorage 변경 감지 (선택사항)
 */
export function useDashboardRefresh({ 
  onRefresh, 
  throttleMs = 5000,
  enableStorageListener = true 
}: UseDashboardRefreshOptions) {
  const lastUpdateTime = useRef(Date.now())
  const refreshTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // 스로틀링된 새로고침 함수
  const throttledRefresh = useCallback(() => {
    const now = Date.now()
    
    // 이전 업데이트로부터 충분한 시간이 지났는지 확인
    if (now - lastUpdateTime.current > throttleMs) {
      lastUpdateTime.current = now
      
      // 기존 타임아웃이 있다면 취소
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      
      // 즉시 실행
      onRefresh()
    } else {
      // 스로틀 기간 내라면 지연 실행
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      
      const remainingTime = throttleMs - (now - lastUpdateTime.current)
      refreshTimeoutRef.current = setTimeout(() => {
        lastUpdateTime.current = Date.now()
        onRefresh()
      }, remainingTime)
    }
  }, [onRefresh, throttleMs])

  // 즉시 새로고침 (스로틀링 무시)
  const forceRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }
    lastUpdateTime.current = Date.now()
    onRefresh()
  }, [onRefresh])

  useEffect(() => {
    // 탭 포커스 이벤트
    const handleFocus = () => {
      console.log('🔄 대시보드 포커스 이벤트')
      throttledRefresh()
    }

    // 페이지 가시성 변경 (탭 전환)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 대시보드 가시성 변경')
        throttledRefresh()
      }
    }

    // 페이지 표시 (뒒로가기/앞으로가기)
    const handlePageShow = (event: PageTransitionEvent) => {
      // persisted가 true면 캐시에서 로드된 것
      if (event.persisted) {
        console.log('🔄 대시보드 캐시에서 복원')
        throttledRefresh()
      }
    }

    // 브라우저 저장소 변경 감지 (다른 탭에서 데이터 변경 시)
    const handleStorageChange = (event: StorageEvent) => {
      // 크레딧이나 검색 관련 키 변경 시에만 반응
      if (event.key && ['credits', 'search_history', 'user_profile'].some(key => event.key?.includes(key))) {
        console.log('🔄 저장소 변경 감지:', event.key)
        throttledRefresh()
      }
    }

    // 이벤트 리스너 등록
    window.addEventListener('focus', handleFocus)
    window.addEventListener('pageshow', handlePageShow as EventListener)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    if (enableStorageListener) {
      window.addEventListener('storage', handleStorageChange)
    }

    // 정리 함수
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pageshow', handlePageShow as EventListener)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      if (enableStorageListener) {
        window.removeEventListener('storage', handleStorageChange)
      }
      
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [throttledRefresh, enableStorageListener])

  return {
    refresh: throttledRefresh,
    forceRefresh
  }
}
