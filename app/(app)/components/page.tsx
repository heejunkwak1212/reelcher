"use client"

import { useEffect, useMemo } from 'react'
import { setCssVariablesFromTheme, cn } from '@/lib/utils'
import { Card, CardBody, CardGrid, DemoHeading, DemoText } from '@/components/layout/ThemeDemoParts'
import { THEME_PAYLOAD } from '@/lib/theme'

export default function ComponentsDemoPage() {
  const theme = useMemo(() => THEME_PAYLOAD.theme, [])

  useEffect(() => {
    setCssVariablesFromTheme(theme)
  }, [theme])

  return (
    <main className={cn('mx-auto max-w-5xl px-6 py-10')}>
      <DemoHeading>Components Preview</DemoHeading>
      <DemoText>Centralized primitives styled by CSS variables from the provided theme.</DemoText>

      <div className="h-4" />

      <CardGrid>
        <Card title="Headings">
          <h1 style={{ fontSize: 'var(--title-2-size)', lineHeight: 'var(--title-2-line-height)', letterSpacing: 'var(--title-2-letter-spacing)', fontWeight: 600, color: 'var(--color-text-primary)' }}>Title 2 Heading</h1>
          <div className="h-3" />
          <h2 style={{ fontSize: 'var(--title-5-size)', lineHeight: 'var(--title-5-line-height)', letterSpacing: 'var(--title-5-letter-spacing)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Title 5 Heading</h2>
          <div className="h-2" />
          <h3 style={{ fontSize: 'var(--title-6-size)', lineHeight: 'var(--title-6-line-height)', letterSpacing: 'var(--title-6-letter-spacing)', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>Title 6 Heading</h3>
        </Card>

        <Card title="Text scale">
          <p style={{ fontSize: 'var(--text-large-size)', lineHeight: 'var(--text-large-line-height)', letterSpacing: 'var(--text-large-letter-spacing)' }}>Large text scale</p>
          <p style={{ fontSize: 'var(--text-regular-size)', lineHeight: 'var(--text-regular-line-height)', letterSpacing: 'var(--text-regular-letter-spacing)' }}>Regular text scale</p>
          <p style={{ fontSize: 'var(--text-small-size)', lineHeight: 'var(--text-small-line-height)', letterSpacing: 'var(--text-small-letter-spacing)' }}>Small text scale</p>
        </Card>

        <Card title="Accents">
          <div className="flex items-center gap-3">
            <div className="size-6 rounded-full" style={{ backgroundColor: '#68CC58' }} />
            <div className="size-6 rounded-full" style={{ backgroundColor: '#D4B144' }} />
            <div className="size-6 rounded-full" style={{ backgroundColor: '#02B8CC' }} />
            <div className="size-6 rounded-full" style={{ backgroundColor: '#f2994a40' }} />
            <div className="size-6 rounded-full" style={{ backgroundColor: '#c5282840' }} />
          </div>
        </Card>

        <Card title="Gradient text">
          <div style={{ background: theme.gradients.textPrimaryToTransparent, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'unset', paddingBottom: '0.13em' }}>Linear-like gradient text</div>
        </Card>

        <Card title="Icon color">
          <svg width="20" height="20" viewBox="0 0 16 16" style={{ color: 'var(--icon-color)', fill: 'var(--icon-color)' }}>
            <circle cx="8" cy="8" r="7" />
          </svg>
        </Card>

        <Card title="Bento border">
          <div style={{ background: 'var(--bento-border)', height: 8, borderRadius: 999 }} />
        </Card>
      </CardGrid>
    </main>
  )
}


