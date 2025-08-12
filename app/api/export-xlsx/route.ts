import { buildWorkbook } from '@/lib/xlsx'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({ rows: [] })) as any
    const rows = Array.isArray(body?.rows) ? body.rows : []
    const buf = buildWorkbook(rows)
    return new Response(Buffer.from(buf), {
      status: 200,
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="reels.xlsx"`,
        'cache-control': 'no-store',
      },
    })
  } catch {
    return new Response('Bad Request', { status: 400 })
  }
}


