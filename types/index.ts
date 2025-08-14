export interface IHashtagItem {
  url: string
  ownerUsername?: string
  likes?: number
  comments?: number
  caption?: string
  timestamp?: string | number
}

export interface IReelDetail {
  url: string
  views?: number
  thumbnailUrl?: string
  videoUrl?: string
  takenAt?: string | number
  duration?: number
  ownerUsername?: string
}

export interface IProfileSummary {
  username?: string
  followers?: number
  following?: number
  profilePicUrl?: string
}

export interface ISearchRow {
  url: string
  username?: string
  views?: number
  likes?: number | 'private'
  comments?: number
  followers?: number
  following?: number
  thumbnailUrl?: string
  videoUrl?: string
  caption?: string
  duration?: number
  takenDate?: string
}

export interface IThemeTypographyScale {
  size: string
  lineHeight: string
  letterSpacing: string
}

export interface IThemeDefinition {
  mode: string
  htmlAttr?: Record<string, string>
  breakpoints: { sm: string; md: string }
  colors: {
    text: {
      primary: string
      secondary: string
      tertiary: string
      quaternary: string
    }
    selection: { dim: string }
    accentsObserved: {
      green: string
      gold: string
      cyan: string
      orangeAlpha: string
      redAlpha: string
    }
  }
  typography: {
    fonts: { monospace: string }
    weights: { normal: string; medium: string }
    scale: {
      title2: IThemeTypographyScale
      title5: IThemeTypographyScale
      title6: IThemeTypographyScale
      textLarge: IThemeTypographyScale
      textRegular: IThemeTypographyScale
      textSmall: IThemeTypographyScale
    }
  }
  radii: { full: string }
  spacingObservedPx: number[]
  gradients: { textPrimaryToTransparent: string }
  icon: { color: string }
  misc: { bentoBorder: string }
}

export interface IThemePayload {
  source: string
  theme: IThemeDefinition
  variableNamesObserved: string[]
}

