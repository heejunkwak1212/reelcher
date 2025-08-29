export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

// 조회수를 천 단위로 포맷팅하는 함수
function formatViewCount(views: number): string {
  if (!views || views < 0) return '0'
  return new Intl.NumberFormat('ko-KR').format(views)
}

export async function POST(request: NextRequest) {
  try {
    const { urls, platform, thumbnailsWithViews } = await request.json()
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'URLs array is required' }, { status: 400 })
    }
    
    // URL과 조회수 정보를 매핑하는 Map 생성
    const viewsMap = new Map<string, {views: number, title: string}>()
    if (Array.isArray(thumbnailsWithViews)) {
      thumbnailsWithViews.forEach((item: any) => {
        viewsMap.set(item.url, { views: item.views, title: item.title })
      })
    }

    if (urls.length === 1) {
      // 단일 썸네일 다운로드
      const url = urls[0]
      const response = await fetch(url)
      
      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to download thumbnail' }, { status: 500 })
      }

      const buffer = await response.arrayBuffer()
      
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
      const platformNames = {
        youtube: 'YouTube',
        tiktok: 'TikTok',
        instagram: 'Instagram'
      }
      const platformName = platformNames[platform as keyof typeof platformNames] || 'Reelcher'
      
      // 조회수 정보 추가
      const viewInfo = viewsMap.get(url)
      const viewCount = viewInfo ? formatViewCount(viewInfo.views) : '0'
      const fileName = `${platformName}_썸네일_${dateStr}_${viewCount}.png`
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
        }
      })
    } else {
      // 다중 썸네일 ZIP 다운로드
      const zip = new JSZip()
      
      for (let i = 0; i < urls.length; i++) {
        try {
          const url = urls[i]
          const response = await fetch(url)
          
          if (response.ok) {
            const buffer = await response.arrayBuffer()
            const extension = url.includes('.jpg') || url.includes('.jpeg') ? 'jpg' : 'png'
            
            // 조회수 정보 추가 - 간단한 형식으로 변경
            const viewInfo = viewsMap.get(url)
            const viewCount = viewInfo ? formatViewCount(viewInfo.views) : '0'
            const now = new Date()
            const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
            
            // 플랫폼별 파일명 생성
            let platformPrefix = 'thumbnail'
            if (platform === 'youtube') platformPrefix = 'youtube'
            else if (platform === 'tiktok') platformPrefix = 'tiktok'
            else if (platform === 'instagram') platformPrefix = 'instagram'
            
            const fileName = `${platformPrefix}_${dateStr}_${viewCount}.${extension}`
            
            zip.file(fileName, buffer)
          }
        } catch (error) {
          console.error(`Failed to download thumbnail ${i + 1}:`, error)
          // 개별 실패는 무시하고 계속 진행
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })
      
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
      const platformNames = {
        youtube: 'YouTube',
        tiktok: 'TikTok',
        instagram: 'Instagram'
      }
      const platformName = platformNames[platform as keyof typeof platformNames] || 'Reelcher'
      
      return new NextResponse(zipBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(`${platformName}_썸네일모음_${dateStr}.zip`)}"`
        }
      })
    }
  } catch (error) {
    console.error('Thumbnail download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
