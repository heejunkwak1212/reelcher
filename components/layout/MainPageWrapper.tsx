'use client'

import { useEffect } from 'react'

export default function MainPageWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // URL에 해시가 있는 경우 해당 섹션으로 스크롤
    const hash = window.location.hash
    if (hash) {
      const targetId = hash.substring(1) // # 제거
      setTimeout(() => {
        if (targetId === 'top') {
          window.scrollTo({ top: 0, behavior: 'smooth' })
          return
        }
        const el = document.getElementById(targetId)
        if (el) {
          const rect = el.getBoundingClientRect()
          const top = window.pageYOffset + rect.top + rect.height / 2 - window.innerHeight / 2
          window.scrollTo({ top, behavior: 'smooth' })
        }
      }, 100) // 페이지 로드 후 약간의 지연
    }
  }, [])

  return <>{children}</>
}
