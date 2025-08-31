"use client"

import { useState } from "react"
import { useRouter, usePathname } from 'next/navigation'

export default function NavAnchor({ target, children }: { target: string; children: React.ReactNode }) {
  const [isHovered, setIsHovered] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    
    // 메인페이지가 아닌 경우, 메인페이지로 이동한 후 섹션으로 스크롤
    if (pathname !== '/') {
      if (target === 'top') {
        router.push('/')
      } else {
        router.push(`/#${target}`)
      }
      return
    }
    
    // 메인페이지인 경우 기존 로직 실행
    if (target === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const el = document.getElementById(target)
    if (!el) return
    const rect = el.getBoundingClientRect()
    const top = window.pageYOffset + rect.top + rect.height / 2 - window.innerHeight / 2
    window.scrollTo({ top, behavior: 'smooth' })
  }
  
  return (
    <a 
      href={`/#${target}`} 
      onClick={onClick} 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`cursor-pointer select-none px-3 py-2 rounded-lg transition-all duration-200 ${
        isHovered 
          ? 'bg-gray-100 shadow-md -translate-y-0.5' 
          : ''
      }`}
    >
      {children}
    </a>
  )
}


