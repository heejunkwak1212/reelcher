import type { IThemePayload } from '@/types'
import { setCssVariablesFromTheme } from '@/lib/utils'

export const THEME_PAYLOAD: IThemePayload = {
  source: 'https://linear.app/',
  theme: {
    mode: 'dark',
    htmlAttr: { 'data-theme': 'dark' },
    breakpoints: { sm: '640px', md: '768px' },
    colors: {
      text: {
        // Linear 다크 톤에 가까운 값으로 기본 매핑 (원하면 여기만 교체)
        primary: '#0B0C0E',
        secondary: '#3A3B3F',
        tertiary: '#9C9DA1',
        quaternary: '#B8B9BD'
      },
      selection: { dim: '#2B5ED21A' },
      accentsObserved: {
        green: '#68CC58',
        gold: '#D4B144',
        cyan: '#02B8CC',
        orangeAlpha: '#f2994a40',
        redAlpha: '#c5282840'
      }
    },
    typography: {
      fonts: { monospace: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' },
      weights: { normal: '400', medium: '600' },
      scale: {
        title2: { size: '32px', lineHeight: '40px', letterSpacing: '-0.01em' },
        title5: { size: '20px', lineHeight: '28px', letterSpacing: '-0.005em' },
        title6: { size: '18px', lineHeight: '26px', letterSpacing: '-0.003em' },
        textLarge: { size: '18px', lineHeight: '28px', letterSpacing: '0' },
        textRegular: { size: '15px', lineHeight: '24px', letterSpacing: '0' },
        textSmall: { size: '13px', lineHeight: '20px', letterSpacing: '0' }
      }
    },
    radii: { full: '50%' },
    spacingObservedPx: [4, 6, 8, 16, 22, 24, 32, 64],
    gradients: { textPrimaryToTransparent: 'linear-gradient(to right, #0B0C0E, transparent 80%), #9C9DA1' },
    icon: { color: '#0B0C0E' },
    misc: { bentoBorder: 'color-mix(in lab, #9C9DA1 14%, transparent)' }
  },
  variableNamesObserved: [
    '--color-text-primary','--color-text-secondary','--color-text-tertiary','--color-text-quaternary','--color-selection-dim','--title-2-size','--title-2-line-height','--title-2-letter-spacing','--title-5-size','--title-5-line-height','--title-5-letter-spacing','--title-6-size','--title-6-line-height','--title-6-letter-spacing','--text-large-size','--text-large-line-height','--text-large-letter-spacing','--text-regular-size','--text-regular-line-height','--text-regular-letter-spacing','--text-small-size','--text-small-line-height','--text-small-letter-spacing','--font-monospace','--font-weight-medium','--font-weight-normal','--icon-color','--bento-border'
  ]
}

export function applyThemeVariables() {
  if (typeof window === 'undefined') return
  setCssVariablesFromTheme(THEME_PAYLOAD.theme)
}


