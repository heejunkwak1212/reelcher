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
import { downloadYouTubeVideo, cleanupVideoFile } from '@/lib/youtube-downloader'
import { promises as fs } from 'fs'

// 조회수를 천 단위로 포맷팅하는 함수
function formatViewCount(views: number): string {
  if (!views || views < 0) return '0'
  return new Intl.NumberFormat('ko-KR').format(views)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const urls: string[] = Array.isArray(body?.urls) ? body.urls.filter(isSafeUrl) : []
    const urlsWithViews: Array<{url: string, views: number, title: string}> = body?.urlsWithViews || []
    
    if (!urls.length) return new Response('No urls', { status: 400 })
    
    // URL과 조회수 정보를 매핑하는 Map 생성
    const viewsMap = new Map<string, {views: number, title: string}>()
    urlsWithViews.forEach(item => {
      viewsMap.set(item.url, { views: item.views, title: item.title })
    })
    
    if (urls.length === 1) {
      const url = urls[0]
      
      // YouTube URL인 경우 yt-dlp 사용
      if (isYouTubeUrl(url)) {
        try {
          console.log('YouTube 다운로드 시작:', url)
          const result = await downloadYouTubeVideo(url, {

          })
          
          console.log('YouTube 다운로드 결과:', result)
          
          if (!result.success || !result.filePath) {
            console.error('YouTube 다운로드 실패:', result.error)
            return new Response(result.error || 'Download failed', { status: 502 })
          }
          
          console.log('파일 읽기 시작:', result.filePath)
          const fileBuffer = await fs.readFile(result.filePath)
          console.log('파일 읽기 완료, 크기:', fileBuffer.length)
          
          // 파일 정리
          cleanupVideoFile(result.filePath).catch(() => {})
          
                  // 파일명 정리: 특수문자 제거하고 길이 제한
        let cleanTitle = result.title || 'youtube-video'
        cleanTitle = cleanTitle
          .replace(/[^a-zA-Z0-9가-힣\s\-_]/g, '') // 특수문자 제거
          .replace(/\s+/g, ' ') // 연속 공백을 하나로
          .trim() // 앞뒤 공백 제거
          .substring(0, 40) // 조회수 추가로 인해 길이 단축
        
        // 조회수 정보 추가
        const viewInfo = viewsMap.get(url)
        const viewCount = viewInfo ? formatViewCount(viewInfo.views) : '0'
        const fileName = cleanTitle ? `${cleanTitle}_${viewCount}.mp4` : `youtube-video_${viewCount}.mp4`
          
          console.log('Response 생성 시작, 파일명:', fileName)
          
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
          const result = await downloadYouTubeVideo(url, {

          })
          
          if (!result.success || !result.filePath) {
            return new Response(result.error || 'TikTok download failed', { status: 502 })
          }
          
          const fileBuffer = await fs.readFile(result.filePath)
          
          // 파일 정리
          cleanupVideoFile(result.filePath).catch(() => {})
          
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
        let retries = 2; // 2번 재시도
        let success = false;
        
        while (retries > 0 && !success) {
          try {
          if (isYouTubeUrl(url)) {
            console.log(`🎬 YouTube 다운로드 시작 (${current + 1}/${urls.length}):`, url);
            // YouTube URL 처리
            const result = await downloadYouTubeVideo(url, {
  
            })
            
            console.log(`📊 다운로드 결과 (${current + 1}/${urls.length}):`, { 
              success: result.success, 
              title: result.title,
              filePath: result.filePath ? 'OK' : 'MISSING'
            });
            
            if (result.success && result.filePath) {
              const buf = await fs.readFile(result.filePath)
              
              // 조회수 정보 추가 - 간단한 형식으로 변경
              const viewInfo = viewsMap.get(url)
              const viewCount = viewInfo ? formatViewCount(viewInfo.views) : '0'
              const now = new Date()
              const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
              const fileName = `youtube_${dateStr}_${viewCount}.mp4`
              
              console.log(`📁 파일명 생성 (${current + 1}/${urls.length}):`, fileName);
              files.push({ name: fileName, data: buf as unknown as ArrayBuffer })
              
              // 파일 정리
              cleanupVideoFile(result.filePath).catch(() => {})
            } else {
              console.error(`❌ YouTube 다운로드 실패 (${current + 1}/${urls.length}):`, result.error);
            }
          } else if (isTikTokDirectUrl(url)) {
            // TikTok Apify 직접 URL 처리
            const res = await fetch(url)
            if (res.ok) {
              const buf = await res.arrayBuffer()
              
              // 조회수 정보 추가 - 간단한 형식으로 변경
              const viewInfo = viewsMap.get(url)
              const viewCount = viewInfo ? formatViewCount(viewInfo.views) : '0'
              const now = new Date()
              const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
              const fileName = `tiktok_${dateStr}_${viewCount}.mp4`
              
              console.log(`📁 TikTok 직접 URL 파일명 생성 (${current + 1}/${urls.length}):`, fileName, 'viewInfo:', viewInfo);
              
              files.push({ name: fileName, data: buf })
            }
          } else if (isTikTokUrl(url)) {
            console.log(`🎵 TikTok 다운로드 시작 (${current + 1}/${urls.length}):`, url);
            // TikTok 웹 URL 처리 (yt-dlp 사용)
            const result = await downloadYouTubeVideo(url, {
  
            })
            
            console.log(`📊 TikTok 다운로드 결과 (${current + 1}/${urls.length}):`, { 
              success: result.success, 
              title: result.title,
              filePath: result.filePath ? 'OK' : 'MISSING'
            });
            
            if (result.success && result.filePath) {
              const buf = await fs.readFile(result.filePath)
              
              // 조회수 정보 추가 - 간단한 형식으로 변경
              const viewInfo = viewsMap.get(url)
              const viewCount = viewInfo ? formatViewCount(viewInfo.views) : '0'
              const now = new Date()
              const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
              const fileName = `tiktok_${dateStr}_${viewCount}.mp4`
              
              console.log(`📁 TikTok 파일명 생성 (${current + 1}/${urls.length}):`, fileName);
              files.push({ name: fileName, data: buf as unknown as ArrayBuffer })
              
              // 파일 정리
              cleanupVideoFile(result.filePath).catch(() => {})
            } else {
              console.error(`❌ TikTok 다운로드 실패 (${current + 1}/${urls.length}):`, result.error);
            }
          } else {
            // 일반 URL 처리 (Instagram 등)
            const res = await fetch(url)
            if (!res.ok) continue
            const buf = await res.arrayBuffer()
            
            // 조회수 정보 추가 - 간단한 형식으로 변경
            const viewInfo = viewsMap.get(url)
            const viewCount = viewInfo ? formatViewCount(viewInfo.views) : '0'
            const now = new Date()
            const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
            const fileName = `instagram_${dateStr}_${viewCount}.mp4`
            
            console.log(`📁 Instagram 파일명 생성 (${current + 1}/${urls.length}):`, fileName, 'viewInfo:', viewInfo);
            
            files.push({ name: fileName, data: buf })
          }
          success = true; // 성공시 루프 종료
          } catch (error) { 
            retries--;
            console.error(`❌ URL 처리 실패 (${current + 1}/${urls.length}) - 재시도 ${2 - retries}/2:`, url, error);
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기 후 재시도
            }
          }
        }
      }
    }
    
    await Promise.all(new Array(concurrency).fill(0).map(() => worker()))
    
    console.log(`🎯 다운로드 완료 요약: ${files.length}/${urls.length} 성공`);
    console.log(`📁 ZIP 파일에 포함될 파일들:`, files.map(f => f.name));
    
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


