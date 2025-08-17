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
    const dateTimeStr = `${year}-${month}-${day}-${hours}${minutes}` // YYYY-MM-DD-HHMM 형식
    
    const platformNames = {
      youtube: 'YouTube',
      tiktok: 'TikTok', 
      instagram: 'Instagram'
    }
    
    const filename = `${platformNames[platform as keyof typeof platformNames] || 'Reelcher'}_데이터_${dateTimeStr}.xlsx`
    
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


