'use client'

import Image from 'next/image'
import { useState } from 'react'
import logoSvg from '@/public/logo.svg'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  showText?: boolean
}

export function Logo({ className = '', size = 'md', showText = true }: LogoProps) {
  const [hasError, setHasError] = useState(false)
  
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
    '2xl': 'w-16 h-16'
  }
  
  const sizeNumbers = {
    sm: 24,
    md: 32,
    lg: 40,
    xl: 48,
    '2xl': 64
  }
  
  const textSizeClasses = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
    '2xl': 'text-3xl'
  }

  // Fallback text logo if image fails
  if (hasError) {
    return (
      <div className={`flex items-center gap-0.2 ${className}`}>
        <div className={`${sizeClasses[size]} bg-black text-white rounded flex items-center justify-center font-bold text-sm flex-shrink-0`}>
          R
        </div>
        {showText && (
          <span className={`font-bold ${textSizeClasses[size]} text-black`}>
            Reelcher
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={`flex items-center ${size === '2xl' ? 'gap-0.05' : 'gap-0.1'} ${className}`}>
      <div className={`${sizeClasses[size]} flex-shrink-0 relative`}>
        <Image
          src={logoSvg}
          alt="Reelcher Logo"
          width={sizeNumbers[size]}
          height={sizeNumbers[size]}
          className="w-full h-full object-contain"
          priority={true}
          unoptimized={true}
          onError={() => setHasError(true)}
        />
      </div>
      {showText && (
        <span className={`font-bold ${textSizeClasses[size]} text-black`}>
          Reelcher
        </span>
      )}
    </div>
  )
}

// Responsive logo component that adapts to screen size
export function ResponsiveLogo({ className = '' }: { className?: string }) {
  return (
    <>
      {/* Mobile: Small logo with text */}
      <div className={`block sm:hidden ${className}`}>
        <Logo size="sm" showText={true} />
      </div>
      
      {/* Tablet: Medium logo with text */}
      <div className={`hidden sm:block lg:hidden ${className}`}>
        <Logo size="md" showText={true} />
      </div>
      
      {/* Desktop: Large logo with text */}
      <div className={`hidden lg:block ${className}`}>
        <Logo size="lg" showText={true} />
      </div>
    </>
  )
}

// Default export for easier importing
export default Logo
