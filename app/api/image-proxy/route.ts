export const runtime = 'nodejs'

function isSafeUrl(u?: string): boolean {
  if (!u) return false
  try {
    const url = new URL(u)
    // allow only http/https
    if (!/^https?:$/.test(url.protocol)) return false
    return true
  } catch {
    return false
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const src = searchParams.get('src') || searchParams.get('url') || undefined
    const download = searchParams.get('download') === 'true'
    const shorts = searchParams.get('shorts') === 'true'
    const view = searchParams.get('view') === 'true'
    if (!isSafeUrl(src)) return new Response('Bad Request', { status: 400 })
    // Fetch helper with platform-friendly headers
    const fetchWithHeaders = async (url: string) => {
      // Platform별 referer 설정
      let referer = 'https://www.instagram.com/'
      if (url.includes('tiktok') || url.includes('byteoversea') || url.includes('muscdn')) {
        referer = 'https://www.tiktok.com/'
      } else if (url.includes('apify')) {
        referer = 'https://api.apify.com/'
      }
      
      return fetch(url, {
        headers: {
          'referer': referer,
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'image',
          'sec-fetch-mode': 'no-cors',
          'sec-fetch-site': 'cross-site',
        },
        redirect: 'follow',
        cache: 'no-store',
      })
    }

    // 1) Primary try: requested src
    let upstream = await fetchWithHeaders(src!)

    // 2) Fallback: if src is Apify images CDN (cb:1) and failed, decode to original and try again
    if (!upstream.ok) {
      try {
        const u = new URL(src!)
        const m = u.pathname.match(/\/cb:1\/([^/.]+)\.[a-zA-Z0-9]+$/)
        if (m && m[1]) {
          const decoded = Buffer.from(m[1], 'base64').toString('utf8')
          if (isSafeUrl(decoded)) {
            const second = await fetchWithHeaders(decoded)
            if (second.ok) {
              upstream = second
            }
          }
        }
      } catch {}
    }

    // If upstream still not ok or not an image, return 404 to trigger <img onError>
    const ct0 = upstream.headers.get('content-type') || ''
    if (!upstream.ok || !/^image\//i.test(ct0)) {
      return new Response('not-image', { status: 404, headers: { 'cache-control': 'no-store', 'x-proxy': 'image-proxy:404' } })
    }

    const ct = ct0 || 'image/jpeg'
    const headers: Record<string, string> = {
      'content-type': ct,
      'cache-control': view ? 'public, max-age=3600' : 'public, max-age=86400', // view 모드는 1시간 캐시
      'x-proxy': view ? 'image-proxy:view' : 'image-proxy',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET',
      'access-control-allow-headers': 'Content-Type',
    }
    
    // view 모드일 때 추가 보안 헤더
    if (view) {
      headers['x-content-type-options'] = 'nosniff'
      headers['x-frame-options'] = 'DENY'
    }
    
    // 다운로드 요청 시 Content-Disposition 헤더 추가
    if (download) {
      const extension = ct.includes('png') ? 'png' : 'jpg'
      const filename = shorts ? `shorts-thumbnail-${Date.now()}.${extension}` : `thumbnail-${Date.now()}.${extension}`
      headers['content-disposition'] = `attachment; filename="${filename}"`
    }
    
    return new Response(upstream.body, {
      status: 200,
      headers,
    })
  } catch (e) {
    return new Response('Bad Request', { status: 400 })
  }
}


