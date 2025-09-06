"use client"

import { cn } from '@/lib/utils'

export function DemoHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className={cn('text-2xl font-bold')} style={{ color: 'var(--color-text-primary)' }}>
      {children}
    </h2>
  )
}

export function DemoText({ children }: { children: React.ReactNode }) {
  return (
    <p className={cn('text-sm opacity-80')} style={{ color: 'var(--color-text-tertiary)' }}>
      {children}
    </p>
  )
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4 mt-6')}>{children}</div>
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border p-4')}
      style={{ borderColor: 'color-mix(in lab, var(--color-text-tertiary) 16%, transparent)', background: 'color-mix(in lab, var(--color-text-tertiary) 5%, transparent)' }}>
      <div className={cn('text-sm font-semibold mb-3')} style={{ color: 'var(--color-text-secondary)' }}>{title}</div>
      <CardBody>{children}</CardBody>
    </div>
  )
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className={cn('space-y-2')}>{children}</div>
}


