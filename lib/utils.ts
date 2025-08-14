import { type ClassValue } from 'clsx'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function setCssVariablesFromTheme(theme: import('@/types').IThemeDefinition) {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  if (theme.htmlAttr) {
    for (const [k, v] of Object.entries(theme.htmlAttr)) {
      root.setAttribute(k, v)
    }
  }
  const map: Record<string, string> = {
    '--color-text-primary': theme.colors.text.primary,
    '--color-text-secondary': theme.colors.text.secondary,
    '--color-text-tertiary': theme.colors.text.tertiary,
    '--color-text-quaternary': theme.colors.text.quaternary,
    '--color-selection-dim': theme.colors.selection.dim,
    '--font-monospace': theme.typography.fonts.monospace,
    '--font-weight-normal': theme.typography.weights.normal,
    '--font-weight-medium': theme.typography.weights.medium,
    '--title-2-size': theme.typography.scale.title2.size,
    '--title-2-line-height': theme.typography.scale.title2.lineHeight,
    '--title-2-letter-spacing': theme.typography.scale.title2.letterSpacing,
    '--title-5-size': theme.typography.scale.title5.size,
    '--title-5-line-height': theme.typography.scale.title5.lineHeight,
    '--title-5-letter-spacing': theme.typography.scale.title5.letterSpacing,
    '--title-6-size': theme.typography.scale.title6.size,
    '--title-6-line-height': theme.typography.scale.title6.lineHeight,
    '--title-6-letter-spacing': theme.typography.scale.title6.letterSpacing,
    '--text-large-size': theme.typography.scale.textLarge.size,
    '--text-large-line-height': theme.typography.scale.textLarge.lineHeight,
    '--text-large-letter-spacing': theme.typography.scale.textLarge.letterSpacing,
    '--text-regular-size': theme.typography.scale.textRegular.size,
    '--text-regular-line-height': theme.typography.scale.textRegular.lineHeight,
    '--text-regular-letter-spacing': theme.typography.scale.textRegular.letterSpacing,
    '--text-small-size': theme.typography.scale.textSmall.size,
    '--text-small-line-height': theme.typography.scale.textSmall.lineHeight,
    '--text-small-letter-spacing': theme.typography.scale.textSmall.letterSpacing,
    '--icon-color': theme.icon.color,
    '--bento-border': theme.misc.bentoBorder
  }
  for (const [k, v] of Object.entries(map)) {
    if (v) root.style.setProperty(k, v)
  }
}


