"use client"
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface ExpandableTextProps {
  text: string
  maxLength?: number
  className?: string
}

export function ExpandableText({ text, maxLength = 50, className = "" }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  if (!text || text.length <= maxLength) {
    return <span className={className}>{text}</span>
  }
  
  const truncatedText = text.substring(0, maxLength)
  
  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <span className="font-normal text-sm">
          {isExpanded ? text : `${truncatedText}...`}
        </span>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-500 hover:text-blue-700 p-1 rounded"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>
      </div>
    </div>
  )
}

