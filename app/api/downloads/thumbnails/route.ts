export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

export async function POST(request: NextRequest) {
  try {
    const { urls, platform } = await request.json()
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'URLs array is required' }, { status: 400 })
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
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(`${platformName}_썸네일_${dateStr}.png`)}"`
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
            zip.file(`thumbnail_${i + 1}.${extension}`, buffer)
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
