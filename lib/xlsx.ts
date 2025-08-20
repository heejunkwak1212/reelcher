import * as XLSX from 'xlsx-js-style'

interface ExcelRow {
  url?: string
  thumbnailUrl?: string
  username?: string
  views?: number
  likes?: number | 'private'
  comments?: number
  followers?: number
  caption?: string
  takenDate?: string
  durationDisplay?: string
  duration?: number
  isShorts?: boolean
  channelId?: string
  channelUrl?: string
}

export function buildWorkbook(rows: ExcelRow[], platform: 'youtube' | 'tiktok' | 'instagram' = 'instagram', origin?: string): ArrayBuffer {
  // 플랫폼별 컬럼 매핑
  const columnMappings = {
    youtube: {
      'thumbnailUrl': '썸네일',
      'takenDate': '업로드 날짜',
      'views': '조회수',
      'durationDisplay': '영상 길이',
      'likes': '좋아요',
      'comments': '댓글수',
      'caption': '제목',
      'username': '채널명',
      'followers': '구독자수',
      'url': '영상 URL',
      'channelUrl': '채널 URL'
    },
    tiktok: {
      'thumbnailUrl': '썸네일',
      'takenDate': '업로드 날짜',
      'views': '조회수',
      'durationDisplay': '영상 길이',
      'likes': '좋아요',
      'comments': '댓글수',
      'username': '계정명',
      'followers': '팔로워수',
      'url': '영상 URL',
      'profileUrl': '계정 URL'
    },
    instagram: {
      'thumbnailUrl': '썸네일',
      'takenDate': '업로드 날짜',
      'views': '조회수',
      'durationDisplay': '영상 길이',
      'likes': '좋아요',
      'comments': '댓글수',
      'username': '계정명',
      'followers': '팔로워수',
      'url': '릴스 URL',
      'profileUrl': '계정 URL'
    }
  }

  const columns = columnMappings[platform]
  
  // 스타일 정의 - 요청에 맞는 색상으로 변경
  const headerStyle = {
    font: { bold: true, sz: 11, name: '맑은 고딕', color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '6B6B6B' } }, // 회색 헤더로 변경
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
      left: { style: 'thin', color: { rgb: 'D1D5DB' } },
      right: { style: 'thin', color: { rgb: 'D1D5DB' } }
    }
  }
  
  const cellStyle = {
    font: { sz: 10, name: '맑은 고딕', color: { rgb: '000000' } }, // 검은색 글씨
    fill: { fgColor: { rgb: 'FFFFFF' } }, // 흰색 배경
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } }
    }
  }

  const thumbnailCellStyle = {
    ...cellStyle,
    fill: { fgColor: { rgb: 'FFFFFF' } }, // 썸네일도 흰색 배경
    font: { sz: 10, name: '맑은 고딕', color: { rgb: '000000' }, bold: false }, // 검은색 글씨, 볼드 제거
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
  }
  
  // 데이터 변환
  const transformedRows = rows.map((row) => {
    const transformed: Record<string, any> = {}
    
    // 1. 썸네일 처리 - 클릭 가능한 링크로 설정
    if (row.thumbnailUrl) {
      if (origin) {
        const proxyUrl = `${origin}/api/image-proxy?url=${encodeURIComponent(row.thumbnailUrl)}&view=true`
        transformed[columns.thumbnailUrl] = '[ 썸네일 보기 ]'
        // 하이퍼링크는 별도 처리
      } else {
        transformed[columns.thumbnailUrl] = '[ 썸네일 보기 ]'
      }
    }
    
    // 2. 업로드 날짜+시간
    if (row.takenDate) {
      const date = new Date(row.takenDate)
      if (!isNaN(date.getTime())) {
        const dateStr = date.toISOString().split('T')[0]
        const timeStr = date.toTimeString().substring(0, 5)
        transformed[columns.takenDate] = `${dateStr}\n${timeStr}`
      } else {
        transformed[columns.takenDate] = row.takenDate
      }
    }
    
    // 3. 조회수
    if (typeof row.views === 'number') {
      transformed[columns.views] = new Intl.NumberFormat('ko-KR').format(row.views)
    }
    
    // 4. 영상 길이
    if ((platform === 'youtube' || platform === 'tiktok' || platform === 'instagram') && 'durationDisplay' in columns) {
      if (row.durationDisplay) {
        transformed[columns.durationDisplay as keyof typeof columns] = row.durationDisplay
      } else if (typeof row.duration === 'number') {
        const minutes = Math.floor(row.duration / 60)
        const seconds = row.duration % 60
        transformed[columns.durationDisplay as keyof typeof columns] = `${minutes}:${seconds.toString().padStart(2, '0')}`
      }
    }
    
    // 5. 좋아요
    if (row.likes === 'private' || row.likes === 0) {
      transformed[columns.likes] = '-'
    } else if (typeof row.likes === 'number') {
      transformed[columns.likes] = new Intl.NumberFormat('ko-KR').format(row.likes)
    }
    
    // 6. 댓글수
    if (typeof row.comments === 'number') {
      transformed[columns.comments] = new Intl.NumberFormat('ko-KR').format(row.comments)
    }
    
    // 7. 사용자명/채널명
    if (row.username) {
      transformed[columns.username] = platform === 'youtube' ? row.username : `@${row.username}`
    }
    
    // 8. 팔로워/구독자수
    if (typeof row.followers === 'number') {
      transformed[columns.followers] = new Intl.NumberFormat('ko-KR').format(row.followers)
    }
    
    // 9. 영상/릴스 URL
    if (row.url) {
      transformed[columns.url] = row.url
    }
    
    // 10. 채널/계정 URL
    if (platform === 'youtube') {
      if (row.channelUrl) {
        transformed[columns['channelUrl' as keyof typeof columns]] = row.channelUrl
      } else if (row.channelId) {
        transformed[columns['channelUrl' as keyof typeof columns]] = `https://www.youtube.com/channel/${row.channelId}`
      } else if (row.username) {
        transformed[columns['channelUrl' as keyof typeof columns]] = `https://www.youtube.com/channel/${row.username}`
      }
    } else if (platform === 'tiktok' && row.username) {
      transformed[columns['profileUrl' as keyof typeof columns] || 'profileUrl'] = `https://www.tiktok.com/@${row.username}`
    } else if (platform === 'instagram' && row.username) {
      transformed[columns['profileUrl' as keyof typeof columns] || 'profileUrl'] = `https://www.instagram.com/${row.username}/`
    }
    
    // 11. 캡션/제목
    if (row.caption && platform === 'youtube' && 'caption' in columns) {
      const trimmedCaption = row.caption.length > 200 
        ? row.caption.substring(0, 200) + '...' 
        : row.caption
      transformed[columns.caption as keyof typeof columns] = trimmedCaption
    }
    
    return transformed
  })
  
  // 워크시트 생성
  const ws = XLSX.utils.json_to_sheet(transformedRows, { header: Object.values(columns) })
  
  // 컬럼 너비 설정
  const colWidths = Object.keys(columns).map(key => {
    switch(key) {
      case 'thumbnailUrl': return { wch: 15 }
      case 'takenDate': return { wch: 18 }
      case 'caption': return { wch: 40 }
      case 'url': case 'channelUrl': case 'profileUrl': return { wch: 50 }
      case 'username': return { wch: 20 }
      default: return { wch: 12 }
    }
  })
  ws['!cols'] = colWidths
  
  // 행 높이 설정
  ws['!rows'] = [
    { hpt: 25 }, // 헤더 행
    ...transformedRows.map(() => ({ hpt: 60 })) // 데이터 행 (높게 설정)
  ]
  
  // 모든 셀에 스타일 적용
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
      
      if (!ws[cellAddress]) continue
      
      if (row === 0) {
        // 헤더 스타일 적용
        ws[cellAddress].s = headerStyle
      } else if (col === 0) {
        // 썸네일 컬럼 스타일 적용
        ws[cellAddress].s = thumbnailCellStyle
        
        // 썸네일 링크 처리
        if (rows[row - 1]?.thumbnailUrl && origin) {
          const proxyUrl = `${origin}/api/image-proxy?url=${encodeURIComponent(rows[row - 1].thumbnailUrl!)}&view=true`
          ws[cellAddress].l = { Target: proxyUrl }
        }
      } else {
        // 일반 셀 스타일 적용 (중앙 정렬)
        ws[cellAddress].s = cellStyle
      }
    }
  }
  
  // 워크북 생성 - 날짜/시간 포함한 시트명
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const timestamp = `${year}${month}${day}-${hour}${minute}`
  
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `${platform}-data-${timestamp}`)
  
  // ArrayBuffer로 변환
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
  
  // type: 'buffer'는 ArrayBuffer를 직접 반환
  return wbout as ArrayBuffer
}