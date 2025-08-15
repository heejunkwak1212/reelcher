"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface AnchorItem {
  name: string
  target: string
}

interface AnchorNavBarProps {
  items: AnchorItem[]
  className?: string
}

export function AnchorNavBar({ items, className }: AnchorNavBarProps) {
  const [activeTab, setActiveTab] = useState(items[0].name)

  const handleAnchorClick = (target: string, name: string) => {
    setActiveTab(name)
    
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
    <div className={cn("flex items-center gap-1 bg-background/5 border border-border backdrop-blur-lg py-1 px-1 rounded-full shadow-lg", className)}>
      {items.map((item) => {
        const isActive = activeTab === item.name

        return (
          <a
            key={item.name}
            href={`/#${item.target}`}
            onClick={(e) => {
              e.preventDefault()
              handleAnchorClick(item.target, item.name)
            }}
            className={cn(
              "relative cursor-pointer text-sm font-semibold px-4 py-2 rounded-full transition-colors",
              "text-gray-600 hover:text-gray-900",
              isActive && "bg-gray-100 text-gray-900"
            )}
          >
            {item.name}
            {isActive && (
              <motion.div
                layoutId="anchor-lamp"
                className="absolute inset-0 w-full bg-gray-900/5 rounded-full -z-10"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
              >
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-gray-800 rounded-t-full">
                  <div className="absolute w-12 h-6 bg-gray-600/20 rounded-full blur-md -top-2 -left-2" />
                  <div className="absolute w-8 h-6 bg-gray-600/20 rounded-full blur-md -top-1" />
                  <div className="absolute w-4 h-4 bg-gray-600/20 rounded-full blur-sm top-0 left-2" />
                </div>
              </motion.div>
            )}
          </a>
        )
      })}
    </div>
  )
}
