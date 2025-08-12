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
    const src = searchParams.get('src') || undefined
    if (!isSafeUrl(src)) return new Response('Bad Request', { status: 400 })
    // Fetch helper with Instagram-friendly headers
    const fetchWithHeaders = async (url: string) => {
      return fetch(url, {
        headers: {
          // Some CDNs require an Instagram referer
          'referer': 'https://www.instagram.com/',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
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
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'content-type': ct,
        'cache-control': 'public, max-age=86400',
        'x-proxy': 'image-proxy',
      },
    })
  } catch (e) {
    return new Response('Bad Request', { status: 400 })
  }
}


