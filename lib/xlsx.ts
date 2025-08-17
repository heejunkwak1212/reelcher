import * as XLSX from 'xlsx'
import { WorkBook, WorkSheet, CellAddress } from 'xlsx'

// 서버 환경에서 이미지 삽입을 위한 타입 (runtime: nodejs에서만 사용)
declare const process: any

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
  channelId?: string // YouTube 채널 ID
  channelUrl?: string // 실제 채널 URL
}

export function buildWorkbook(rows: ExcelRow[], platform: 'youtube' | 'tiktok' | 'instagram' = 'instagram', origin?: string): ArrayBuffer {
  // 플랫폼별 한글 컬럼명 정의 (요청된 순서에 맞게 조정)
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
      'likes': '좋아요',
      'comments': '댓글수',
      'username': '계정명',
      'followers': '팔로워수',
      'url': '릴스 URL',
      'profileUrl': '계정 URL'
    }
  }

  const columns = columnMappings[platform]
  
  // 데이터 변환 및 정리 (요청된 순서대로)
  const transformedRows = rows.map(row => {
    const transformed: Record<string, any> = {}
    
    // 1. 썸네일 URL (첫 번째 컬럼) - 버튼 스타일 표시
    if (row.thumbnailUrl) {
      // 버튼처럼 보이는 세련된 표시
      transformed[columns.thumbnailUrl] = `[ 이미지 보기 ]`
    }
    
    // 2. 업로드 날짜
    if (row.takenDate) {
      transformed[columns.takenDate] = row.takenDate
    }
    
    // 3. 조회수 (TikTok은 정확한 숫자, 다른 플랫폼은 천단위 콤마)
    if (typeof row.views === 'number') {
      transformed[columns.views] = platform === 'tiktok' 
        ? row.views.toString() 
        : new Intl.NumberFormat('ko-KR').format(row.views)
    }
    
    // 4. 영상 길이 (YouTube와 TikTok만)
    if ((platform === 'youtube' || platform === 'tiktok') && 'durationDisplay' in columns) {
      if (row.durationDisplay) {
        transformed[columns.durationDisplay as keyof typeof columns] = row.durationDisplay
      } else if (typeof row.duration === 'number') {
        const minutes = Math.floor(row.duration / 60)
        const seconds = row.duration % 60
        transformed[columns.durationDisplay as keyof typeof columns] = `${minutes}:${seconds.toString().padStart(2, '0')}`
      }
    }
    
    // 5. 좋아요 (TikTok은 정확한 숫자, 다른 플랫폼은 천단위 콤마)
    if (row.likes === 'private' || row.likes === 0) {
      transformed[columns.likes] = '-'
    } else if (typeof row.likes === 'number') {
      transformed[columns.likes] = platform === 'tiktok' 
        ? row.likes.toString() 
        : new Intl.NumberFormat('ko-KR').format(row.likes)
    }
    
    // 6. 댓글수 (TikTok은 정확한 숫자, 다른 플랫폼은 천단위 콤마)
    if (typeof row.comments === 'number') {
      transformed[columns.comments] = platform === 'tiktok' 
        ? row.comments.toString() 
        : new Intl.NumberFormat('ko-KR').format(row.comments)
    }
    
    // 7. 캡션/제목 (YouTube만)
    if (row.caption && platform === 'youtube' && 'caption' in columns) {
      // 긴 텍스트는 200자로 제한 (제목은 더 길게)
      const trimmedCaption = row.caption.length > 200 
        ? row.caption.substring(0, 200) + '...' 
        : row.caption
      transformed[columns.caption as keyof typeof columns] = trimmedCaption
    }
    
    // 8. 사용자명/채널명
    if (row.username) {
      transformed[columns.username] = platform === 'youtube' ? row.username : `@${row.username}`
    }
    
    // 9. 팔로워/구독자수 (천단위 콤마)
    if (typeof row.followers === 'number') {
      transformed[columns.followers] = new Intl.NumberFormat('ko-KR').format(row.followers)
    }
    
    // 10. 영상/릴스 URL
    if (row.url) {
      transformed[columns.url] = row.url
    }
    
    // 11. 채널/계정 URL 생성 (main.py의 로직과 동일하게 처리)
    if (platform === 'youtube') {
      // YouTube는 channelUrl이나 channelId를 우선 사용하여 직접 채널로 이동
      if (row.channelUrl) {
        transformed[columns['channelUrl' as keyof typeof columns]] = row.channelUrl
      } else if (row.channelId) {
        transformed[columns['channelUrl' as keyof typeof columns]] = `https://www.youtube.com/channel/${row.channelId}`
      } else if (row.username) {
        // main.py처럼 직접 채널 ID로 변환하거나, 채널 ID가 없는 경우만 검색 사용
        transformed[columns['channelUrl' as keyof typeof columns]] = `https://www.youtube.com/channel/${row.username}`
      }
    } else if (platform === 'tiktok' && row.username) {
      transformed[columns['profileUrl' as keyof typeof columns] || 'profileUrl'] = `https://www.tiktok.com/@${row.username}`
    } else if (platform === 'instagram' && row.username) {
      transformed[columns['profileUrl' as keyof typeof columns] || 'profileUrl'] = `https://www.instagram.com/${row.username}/`
    }
    
    return transformed
  })

  // 워크시트 생성
  const ws = XLSX.utils.json_to_sheet(transformedRows)
  
  // 컬럼 너비 설정 (새로운 순서에 맞게)
  const columnWidths = [
    { wch: 20 }, // 썸네일
    { wch: 15 }, // 업로드 날짜
    { wch: 15 }, // 조회수
    { wch: 12 }, // 영상 길이
    { wch: 12 }, // 좋아요
    { wch: 12 }, // 댓글수
    { wch: 50 }, // 제목/캡션
    { wch: 20 }, // 채널명/계정명
    { wch: 15 }, // 구독자수/팔로워수
    { wch: 40 }, // 영상 URL
    { wch: 40 }  // 채널/계정 URL
  ]
  ws['!cols'] = columnWidths
  
  // 행 높이 설정 (썸네일 행은 높게)
  const rowHeights = []
  const rowCount = transformedRows.length + 1 // 헤더 포함
  for (let i = 0; i < rowCount; i++) {
    if (i === 0) {
      rowHeights.push({ hpt: 20 }) // 헤더 행 (높이 줄임)
    } else {
      rowHeights.push({ hpt: 35 }) // 데이터 행 (높이 대폭 줄임)
    }
  }
  ws['!rows'] = rowHeights
  
  // 모든 셀을 중앙정렬
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
      if (!ws[cellAddress]) continue
      
      ws[cellAddress].s = {
        alignment: { 
          horizontal: 'center', 
          vertical: 'center',  // center로 다시 변경
          wrapText: true,
          indent: 0,
          textRotation: 0,
          readingOrder: 0,
          shrinkToFit: false
        },
        font: { 
          name: '맑은 고딕',
          sz: 10,
          vertAlign: 'baseline'
        },
        border: {
          top: { style: 'thin', color: { rgb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } }
        }
      }
      
      // 헤더 행은 볼드 처리
      if (row === 0) {
        ws[cellAddress].s.font = { 
          ...ws[cellAddress].s.font,
          bold: true 
        }
        ws[cellAddress].s.fill = {
          fgColor: { rgb: 'F8F9FA' }
        }
      }
      
      // 썸네일 컬럼 (첫 번째 컬럼)은 특별 스타일
      if (col === 0 && row > 0) {
        ws[cellAddress].s.fill = {
          fgColor: { rgb: 'E8F4FD' } // 밝은 파란색 배경
        }
        ws[cellAddress].s.font = {
          ...ws[cellAddress].s.font,
          color: { rgb: 'FFFFFF' }, // 흰색 텍스트 (버튼처럼)
          bold: true
        }
        // 버튼 스타일 배경색
        ws[cellAddress].s.fill = {
          fgColor: { rgb: '3B82F6' } // 파란색 버튼 배경
        }
        // 썸네일 컬럼도 중앙 정렬 강제 적용
        ws[cellAddress].s.alignment = {
          horizontal: 'center',
          vertical: 'center',
          wrapText: true,
          indent: 0,
          textRotation: 0,
          readingOrder: 0,
          shrinkToFit: false
        }
        
        // 썸네일 URL을 하이퍼링크로 설정 (프록시를 통해 Apify URL 숨김)
        if (ws[cellAddress].v && typeof ws[cellAddress].v === 'string' && ws[cellAddress].v.includes('이미지 보기')) {
          // 원본 썸네일 URL을 찾아서 프록시 URL로 변환
          const originalUrl = rows[row - 1]?.thumbnailUrl
          if (originalUrl) {
            // Apify URL을 프록시로 숨김 처리
            let proxyUrl = originalUrl
            if (originalUrl.includes('api.apify.com') || originalUrl.includes('apifyusercontent.com')) {
              // Apify URL을 프록시를 통해 숨김
              const encodedUrl = encodeURIComponent(originalUrl)
              const baseUrl = origin || 'https://reelcher.vercel.app' // 기본 도메인 설정
              proxyUrl = `${baseUrl}/api/image-proxy?url=${encodedUrl}&view=true`
            }
            ws[cellAddress].l = { Target: proxyUrl }
          }
        }
      }
    }
  }

  // 워크북 생성
  const wb = XLSX.utils.book_new()
  const sheetName = platform === 'youtube' ? 'YouTube 데이터' : 
                   platform === 'tiktok' ? 'TikTok 데이터' : 
                   'Instagram 데이터'
  
  // 워크북 기본 속성 설정
  wb.Props = {
    Title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} 검색 결과`,
    Subject: 'Reelcher 데이터 추출',
    Author: 'Reelcher',
    CreatedDate: new Date()
  }
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

// 향후 ExcelJS를 사용한 실제 이미지 삽입 기능을 위한 준비
export async function buildWorkbookWithImages(rows: ExcelRow[], platform: 'youtube' | 'tiktok' | 'instagram' = 'instagram'): Promise<ArrayBuffer> {
  // 현재는 기본 함수와 동일하게 작동하지만, 향후 ExcelJS로 마이그레이션할 때 확장 가능
  try {
    // main.py와 유사한 방식으로 이미지를 다운로드하고 삽입하는 로직을 구현할 수 있습니다
    // 하지만 현재는 브라우저 환경과의 호환성을 위해 기본 함수를 사용합니다
    return buildWorkbook(rows, platform)
  } catch (error) {
    console.error('Error building workbook with images:', error)
    // 오류 발생 시 기본 함수로 폴백
    return buildWorkbook(rows, platform)
  }
}


