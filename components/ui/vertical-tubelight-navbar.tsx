"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { History, CreditCard, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  name: string
  url: string
  icon: string
}

interface VerticalNavBarProps {
  items: NavItem[]
  className?: string
}

const iconMap = {
  'history': History,
  'creditcard': CreditCard,
  'settings': Settings
}

export function VerticalNavBar({ items, className }: VerticalNavBarProps) {
  const [activeTab, setActiveTab] = useState(items[0].name)

  return (
    <div className={cn("space-y-1", className)}>
      {items.map((item) => {
        const IconComponent = iconMap[item.icon as keyof typeof iconMap]
        const isActive = activeTab === item.name

        return (
          <Link
            key={item.name}
            href={item.url}
            onClick={() => setActiveTab(item.name)}
            className={cn(
              "relative flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm",
              "text-gray-600 hover:text-gray-900",
              isActive && "text-gray-900 bg-gray-50"
            )}
          >
            {IconComponent && <IconComponent size={16} strokeWidth={2} />}
            <span>{item.name}</span>
            {isActive && (
              <motion.div
                layoutId="vertical-lamp"
                className="absolute inset-0 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg -z-10"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
              >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gray-800 rounded-r-full">
                  <div className="absolute w-3 h-12 bg-gray-600/20 rounded-full blur-sm -left-1 -top-2" />
                  <div className="absolute w-2 h-8 bg-gray-600/20 rounded-full blur-sm top-0" />
                  <div className="absolute w-1 h-4 bg-gray-600/20 rounded-full blur-sm top-2 left-0.5" />
                </div>
              </motion.div>
            )}
          </Link>
        )
      })}
    </div>
  )
}
