import { buildWorkbook } from '@/lib/xlsx'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({ rows: [], platform: 'instagram' })) as any
    const rows = Array.isArray(body?.rows) ? body.rows : []
    const platform = body?.platform || 'instagram'
    
    // 플랫폼별 파일명 및 날짜/시간 설정
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const dateTimeStr = `${year}-${month}-${day}_${hours}-${minutes}` // 2025-08-18_11-28 형식
    
    const platformNames = {
      youtube: 'youtube',
      tiktok: 'tiktok', 
      instagram: 'instagram'
    }
    
    const filename = `${platformNames[platform as keyof typeof platformNames] || 'reelcher'}-data-${dateTimeStr}.xlsx`
    
    const url = new URL(req.url)
    const origin = url.origin
    const buf = buildWorkbook(rows, platform, origin)
    return new Response(Buffer.from(buf), {
      status: 200,
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Excel export error:', error)
    return new Response('Bad Request', { status: 400 })
  }
}


