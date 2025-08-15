"use client"

import { useState } from "react"

export default function NavAnchor({ target, children }: { target: string; children: React.ReactNode }) {
  const [isHovered, setIsHovered] = useState(false)
  
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
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


