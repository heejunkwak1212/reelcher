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

