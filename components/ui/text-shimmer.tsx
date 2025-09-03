'use client';
import React, { type JSX } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TextShimmerProps {
  children: string;
  as?: React.ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

export function TextShimmer({
  children,
  as: Component = 'p',
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) {
  const MotionComponent = motion(Component as keyof JSX.IntrinsicElements);

  return (
    <MotionComponent
      className={cn(
        'relative inline-block bg-clip-text text-transparent',
        className
      )}
      style={{
        backgroundImage: 'linear-gradient(90deg, #111827 0%, #e5e7eb 50%, #111827 100%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
      animate={{
        backgroundPosition: ['-200% 50%', '200% 50%']
      }}
      transition={{
        duration: duration,
        ease: "easeInOut",
        repeat: Infinity,
        repeatDelay: 0.8
      }}
    >
      {children}
    </MotionComponent>
  );
}
