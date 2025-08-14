"use client"

export default function NavAnchor({ target, children }: { target: string; children: React.ReactNode }) {
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
    <a href={`/#${target}`} onClick={onClick} className="cursor-pointer select-none">
      {children}
    </a>
  )
}


