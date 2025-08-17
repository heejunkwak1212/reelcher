export const runtime = 'nodejs'

const isSafeUrl = (u?: string) => {
  if (!u) return false
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) } catch { return false }
}

const isYouTubeUrl = (u: string) => {
  try {
    const url = new URL(u)
    return url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')
  } catch {
    return false
  }
}

const isTikTokUrl = (u: string) => {
  try {
    const url = new URL(u)
    return url.hostname.includes('tiktok.com')
  } catch {
    return false
  }
}

const isTikTokDirectUrl = (u: string) => {
  try {
    const url = new URL(u)
    return url.hostname.includes('api.apify.com') && u.includes('.mp4')
  } catch {
    return false
  }
}

import JSZip from 'jszip'
import { YouTubeDownloader } from '@/lib/youtube-downloader'
import { promises as fs } from 'fs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const urls: string[] = Array.isArray(body?.urls) ? body.urls.filter(isSafeUrl) : []
    if (!urls.length) return new Response('No urls', { status: 400 })
    
    if (urls.length === 1) {
      const url = urls[0]
      
      // YouTube URL인 경우 yt-dlp 사용
      if (isYouTubeUrl(url)) {
        try {
          const result = await YouTubeDownloader.downloadVideo(url, {
            format: 'best[height<=1080]/bestvideo[height<=1080]+bestaudio/best'
          })
          
          if (!result.success || !result.filePath) {
            return new Response(result.error || 'Download failed', { status: 502 })
          }
          
          const fileBuffer = await fs.readFile(result.filePath)
          
          // 파일 정리
          YouTubeDownloader.cleanup(result.filePath).catch(() => {})
          
          const fileName = result.title ? 
            `${result.title.replace(/[^a-zA-Z0-9가-힣\s\-_]/g, '')}.mp4` : 
            'youtube-video.mp4'
          
          return new Response(new Uint8Array(fileBuffer), {
            status: 200,
            headers: {
              'content-type': 'video/mp4',
              'content-disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
              'cache-control': 'no-store'
            }
          })
        } catch (error) {
          console.error('YouTube 다운로드 오류:', error)
          return new Response(`YouTube 다운로드 실패: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 502 })
        }
      } else if (isTikTokDirectUrl(url)) {
        // TikTok Apify 직접 URL인 경우 (이미 다운로드 가능한 MP4 URL)
        try {
          const upstream = await fetch(url)
          if (!upstream.ok || !upstream.body) return new Response('TikTok video fetch error', { status: 502 })
          
          return new Response(upstream.body, { 
            status: 200, 
            headers: { 
              'content-type': 'video/mp4', 
              'content-disposition': 'attachment; filename="tiktok-video.mp4"', 
              'cache-control': 'no-store' 
            } 
          })
        } catch (error) {
          console.error('TikTok 다운로드 오류:', error)
          return new Response(`TikTok 다운로드 실패: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 502 })
        }
      } else if (isTikTokUrl(url)) {
        // TikTok 웹 URL인 경우 yt-dlp 사용
        try {
          const result = await YouTubeDownloader.downloadVideo(url, {
            format: 'best[height<=1080]/bestvideo[height<=1080]+bestaudio/best'
          })
          
          if (!result.success || !result.filePath) {
            return new Response(result.error || 'TikTok download failed', { status: 502 })
          }
          
          const fileBuffer = await fs.readFile(result.filePath)
          
          // 파일 정리
          YouTubeDownloader.cleanup(result.filePath).catch(() => {})
          
          const fileName = result.title ? 
            `${result.title.replace(/[^a-zA-Z0-9가-힣\s\-_]/g, '')}.mp4` : 
            'tiktok-video.mp4'
          
          return new Response(new Uint8Array(fileBuffer), {
            status: 200,
            headers: {
              'content-type': 'video/mp4',
              'content-disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
              'cache-control': 'no-store'
            }
          })
        } catch (error) {
          console.error('TikTok 다운로드 오류:', error)
          return new Response(`TikTok 다운로드 실패: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 502 })
        }
      } else {
        // 일반 URL 처리 (기존 로직)
        const upstream = await fetch(url)
        if (!upstream.ok || !upstream.body) return new Response('Upstream error', { status: 502 })
        return new Response(upstream.body, { 
          status: 200, 
          headers: { 
            'content-type': upstream.headers.get('content-type') || 'video/mp4', 
            'content-disposition': 'attachment; filename="reel.mp4"', 
            'cache-control': 'no-store' 
          } 
        })
      }
    }
    // Multiple → zip
    const zip = new JSZip()
    // Parallel downloads with limited concurrency for speed
    const concurrency = 3
    let index = 0
    const files: { name: string; data: ArrayBuffer }[] = []
    
    const worker = async () => {
      while (index < urls.length) {
        const current = index++
        const url = urls[current]
        try {
          if (isYouTubeUrl(url)) {
            // YouTube URL 처리
            const result = await YouTubeDownloader.downloadVideo(url, {
              format: 'best[height<=1080]/bestvideo[height<=1080]+bestaudio/best'
            })
            
            if (result.success && result.filePath) {
              const buf = await fs.readFile(result.filePath)
              const fileName = result.title ? 
                `${result.title.replace(/[^a-zA-Z0-9가-힣\s\-_]/g, '')}.mp4` : 
                `youtube-video-${current + 1}.mp4`
              files.push({ name: fileName, data: new Uint8Array(buf) })
              
              // 파일 정리
              YouTubeDownloader.cleanup(result.filePath).catch(() => {})
            }
          } else if (isTikTokDirectUrl(url)) {
            // TikTok Apify 직접 URL 처리
            const res = await fetch(url)
            if (res.ok) {
              const buf = await res.arrayBuffer()
              files.push({ name: `tiktok-video-${current + 1}.mp4`, data: buf })
            }
          } else if (isTikTokUrl(url)) {
            // TikTok 웹 URL 처리 (yt-dlp 사용)
            const result = await YouTubeDownloader.downloadVideo(url, {
              format: 'best[height<=1080]/bestvideo[height<=1080]+bestaudio/best'
            })
            
            if (result.success && result.filePath) {
              const buf = await fs.readFile(result.filePath)
              const fileName = result.title ? 
                `${result.title.replace(/[^a-zA-Z0-9가-힣\s\-_]/g, '')}.mp4` : 
                `tiktok-video-${current + 1}.mp4`
              files.push({ name: fileName, data: new Uint8Array(buf) })
              
              // 파일 정리
              YouTubeDownloader.cleanup(result.filePath).catch(() => {})
            }
          } else {
            // 일반 URL 처리
            const res = await fetch(url)
            if (!res.ok) continue
            const buf = await res.arrayBuffer()
            files.push({ name: `reel-${current + 1}.mp4`, data: buf })
          }
        } catch { 
          /* skip failed */ 
        }
      }
    }
    
    await Promise.all(new Array(concurrency).fill(0).map(() => worker()))
    for (const f of files) zip.file(f.name, f.data)
    const blob = await zip.generateAsync({ type: 'arraybuffer' })
    return new Response(Buffer.from(blob), { 
      status: 200, 
      headers: { 
        'content-type': 'application/zip', 
        'content-disposition': 'attachment; filename="videos.zip"', 
        'cache-control': 'no-store' 
      } 
    })
  } catch {
    return new Response('Bad Request', { status: 400 })
  }
}


