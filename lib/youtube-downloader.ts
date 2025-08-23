import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

export interface DownloadOptions {
  quality?: 'best' | 'worst' | 'bestvideo' | 'bestaudio'
  format?: string
  outputPath?: string
}

export interface DownloadResult {
  success: boolean
  filePath?: string
  error?: string
  title?: string
  duration?: number
  fileSize?: number
}

export interface SubtitleResult {
  success: boolean
  subtitles?: string
  error?: string
  title?: string
}

export class YouTubeDownloader {
  private static isYouTubeUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')
    } catch {
      return false
    }
  }

  private static extractVideoId(url: string): string | null {
    try {
      const parsedUrl = new URL(url)
      
      if (parsedUrl.hostname === 'youtu.be') {
        return parsedUrl.pathname.slice(1)
      }
      
      if (parsedUrl.hostname.includes('youtube.com')) {
        const searchParams = parsedUrl.searchParams
        return searchParams.get('v')
      }
      
      return null
    } catch {
      return null
    }
  }

  static async downloadVideo(url: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    if (!this.isYouTubeUrl(url)) {
      return { success: false, error: 'Invalid YouTube URL' }
    }

    const outputDir = options.outputPath || path.join(os.tmpdir(), 'youtube-downloads')
    
    try {
      // 출력 디렉토리 생성
      await fs.mkdir(outputDir, { recursive: true })
      
      // 한글 파일명 문제를 피하기 위해 고정된 파일명 사용
      const timestamp = Date.now()
      const outputTemplate = path.join(outputDir, `youtube_video_${timestamp}.%(ext)s`)
      
      const args = [
        '--no-warnings',
        '--no-playlist',
        '--format', options.format || options.quality || 'best[height<=1080]/bestvideo[height<=1080]+bestaudio/best',
        '--output', outputTemplate,
        '--print', 'after_move:filepath',
        '--print', 'title',
        '--print', 'duration',
        '--encoding', 'utf-8',  // UTF-8 인코딩 명시
        url
      ]

      console.log('yt-dlp 명령어:', 'yt-dlp', args.join(' '))

      return new Promise((resolve) => {
        // Windows에서는 현재 디렉토리의 yt-dlp.exe 사용
        const ytdlpCommand = process.platform === 'win32' ? './yt-dlp.exe' : 'yt-dlp'
        
        const ytdlp = spawn(ytdlpCommand, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: process.cwd()
        })

        let stdout = ''
        let stderr = ''
        let filePath = ''
        let title = ''
        let duration = 0

        ytdlp.stdout.on('data', (data) => {
          const output = data.toString().trim()
          stdout += output + '\n'
          
          const lines = output.split('\n').filter((line: string) => line.trim())
          for (const line of lines) {
            if (line.includes(outputDir) && (line.endsWith('.mp4') || line.endsWith('.webm') || line.endsWith('.mkv'))) {
              filePath = line.trim()
            } else if (!title && !line.includes('/') && !line.includes('\\')) {
              title = line.trim()
            } else if (!duration && /^\d+$/.test(line.trim())) {
              duration = parseInt(line.trim())
            }
          }
        })

        ytdlp.stderr.on('data', (data) => {
          stderr += data.toString()
        })

        ytdlp.on('close', async (code) => {
          console.log('yt-dlp 완료:', { code, stdout, stderr, filePath, title, duration })

          if (code === 0 && filePath) {
            try {
              const stats = await fs.stat(filePath)
              resolve({
                success: true,
                filePath,
                title: title || 'Unknown',
                duration,
                fileSize: stats.size
              })
            } catch (error) {
              resolve({
                success: false,
                error: `파일 확인 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
              })
            }
          } else {
            resolve({
              success: false,
              error: `다운로드 실패 (코드: ${code}): ${stderr || '알 수 없는 오류'}`
            })
          }
        })

        ytdlp.on('error', (error) => {
          console.error('yt-dlp 실행 오류:', error)
          resolve({
            success: false,
            error: `yt-dlp 실행 실패: ${error.message}`
          })
        })
      })
    } catch (error) {
      return {
        success: false,
        error: `다운로드 준비 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  static async getVideoInfo(url: string): Promise<any> {
    if (!this.isYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL')
    }

    const args = [
      '--no-warnings',
      '--dump-json',
      '--no-playlist',
      url
    ]

    return new Promise((resolve, reject) => {
      // Windows에서는 현재 디렉토리의 yt-dlp.exe 사용
      const ytdlpCommand = process.platform === 'win32' ? './yt-dlp.exe' : 'yt-dlp'
      
      const ytdlp = spawn(ytdlpCommand, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd() // 현재 작업 디렉토리 설정
      })

      let stdout = ''
      let stderr = ''

      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      ytdlp.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout)
            resolve(info)
          } catch (error) {
            reject(new Error(`JSON 파싱 실패: ${error instanceof Error ? error.message : 'Unknown error'}`))
          }
        } else {
          reject(new Error(`정보 가져오기 실패 (코드: ${code}): ${stderr}`))
        }
      })

      ytdlp.on('error', (error) => {
        reject(new Error(`yt-dlp 실행 실패: ${error.message}`))
      })
    })
  }

  /**
   * VTT 자막 내용을 깔끔한 텍스트로 변환
   * - 타임스탬프, align, position 등 메타데이터 제거
   * - [음악], [박수] 등 사운드 태그 제거
   * - 중복 텍스트 제거
   * - HTML 태그 제거
   */
  static parseVttToCleanText(vttContent: string): string {
    const lines = vttContent.split('\n')
    const textLines: string[] = []
    const seenTexts = new Set<string>()

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // 스킵할 라인들
      if (
        !line ||                                                  // 빈 라인
        line.startsWith('WEBVTT') ||                             // VTT 헤더
        line.startsWith('Kind:') ||                              // Kind: captions
        line.startsWith('Language:') ||                          // Language: ko
        line.match(/^\d+$/) ||                                   // 숫자만 있는 라인
        line.match(/^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/) || // 타임스탬프
        line.includes('align:') ||                               // align:start position:0%
        line.includes('position:') ||                            // position 정보
        line.match(/^NOTE /) ||                                  // NOTE 라인
        line.startsWith('<c>') ||                                // VTT 스타일 태그
        line.startsWith('</c>')                                  // VTT 스타일 태그 종료
      ) {
        continue
      }

      // HTML 태그 제거
      let cleanLine = line.replace(/<[^>]*>/g, '')
      
      // 사운드 태그 제거 ([음악], [박수], [웃음] 등)
      cleanLine = cleanLine.replace(/\[[^\]]*\]/g, '')
      
      // >> 표시 제거 (예: ">> 야 자 김민철이" → "야 자 김민철이")
      cleanLine = cleanLine.replace(/^>>\s*/g, '')
      
      // 추가 정리
      cleanLine = cleanLine
        .replace(/&nbsp;/g, ' ')                                 // &nbsp; 제거
        .replace(/&amp;/g, '&')                                  // HTML 엔티티 변환
        .replace(/&lt;/g, '<')                                   // HTML 엔티티 변환
        .replace(/&gt;/g, '>')                                   // HTML 엔티티 변환
        .replace(/\s+/g, ' ')                                    // 연속 공백을 하나로
        .trim()

      // 의미있는 텍스트만 추가 (중복 제거)
      if (cleanLine && cleanLine.length > 1 && !seenTexts.has(cleanLine)) {
        textLines.push(cleanLine)
        seenTexts.add(cleanLine)
      }
    }

    // 최종 텍스트 조합 및 정리
    let result = textLines.join('\n').trim()
    
    // 연속된 줄바꿈 정리
    result = result.replace(/\n\s*\n/g, '\n')
    
    return result
  }

  // 대안 방법: YouTube API를 사용한 자막 추출 (API 키 불필요)
  static async extractSubtitlesAlternative(videoId: string): Promise<SubtitleResult> {
    try {
      // YouTube의 자막 트랙 정보 가져오기
      const trackListUrl = `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`
      const trackResponse = await fetch(trackListUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      })

      if (!trackResponse.ok) {
        throw new Error('자막 트랙 정보를 가져올 수 없습니다')
      }

      const trackListText = await trackResponse.text()
      
      // XML 파싱하여 자막 언어 찾기
      const langRegex = /lang_code="(ko|en|ja|zh)"/g
      const matches = trackListText.match(langRegex)
      
      if (!matches || matches.length === 0) {
        throw new Error('지원되는 자막이 없습니다')
      }

      // 한국어 우선, 없으면 영어
      const preferredLang = matches.find(m => m.includes('ko')) || matches.find(m => m.includes('en')) || matches[0]
      const langCode = preferredLang.match(/lang_code="([^"]+)"/)?.[1] || 'en'

      // 자막 내용 가져오기
      const subtitleUrl = `https://www.youtube.com/api/timedtext?lang=${langCode}&v=${videoId}&fmt=vtt`
      const subtitleResponse = await fetch(subtitleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      })

      if (!subtitleResponse.ok) {
        throw new Error('자막 내용을 가져올 수 없습니다')
      }

      const subtitleContent = await subtitleResponse.text()
      const cleanText = this.parseVttToCleanText(subtitleContent)

      return {
        success: true,
        subtitles: cleanText
      }
    } catch (error) {
      console.error('Alternative subtitle extraction failed:', error)
      return { success: false, error: error instanceof Error ? error.message : '자막 추출 실패' }
    }
  }

  static async extractSubtitles(url: string): Promise<SubtitleResult> {
    if (!this.isYouTubeUrl(url)) {
      return { success: false, error: 'Invalid YouTube URL' }
    }

    // 비디오 ID 추출
    const videoId = this.extractVideoId(url)
    if (!videoId) {
      return { success: false, error: 'YouTube 비디오 ID를 찾을 수 없습니다' }
    }

    // 먼저 대안 방법 시도
    console.log(`[YouTube Subtitle] 대안 방법으로 자막 추출 시도: ${videoId}`)
    const alternativeResult = await this.extractSubtitlesAlternative(videoId)
    
    if (alternativeResult.success) {
      console.log(`[YouTube Subtitle] 대안 방법 성공`)
      return alternativeResult
    }

    console.log(`[YouTube Subtitle] 대안 방법 실패, yt-dlp 시도: ${alternativeResult.error}`)
    // 대안 방법 실패 시 기존 yt-dlp 방법 사용

    const args = [
      '--no-warnings',
      '--no-playlist',
      '--write-auto-sub',        // 자동 생성 자막 다운로드
      '--write-sub',             // 원본 자막 다운로드
      '--sub-langs', 'ko,en,ko-orig,ja,zh,zh-Hans,zh-Hant', // 주요 언어만
      '--sub-format', 'vtt',     // VTT 형식
      '--skip-download',         // 비디오는 다운로드하지 않음
      '--sleep-interval', '3',   // 요청 간 3초 대기 (증가)
      '--max-sleep-interval', '15', // 최대 15초 대기 (증가)
      '--retries', '5',          // 5회 재시도 (증가)
      '--socket-timeout', '60',  // 소켓 타임아웃 60초 (증가)
      '--encoding', 'utf-8',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', // User-Agent 추가
      '--referer', 'https://www.youtube.com/', // Referer 추가
      '--ignore-errors',         // 에러 무시하고 계속 진행
      '--no-abort-on-error',     // 에러 시 중단하지 않음
      '--fragment-retries', '10', // Fragment 재시도 (중요!)
      '--retry-sleep', '5',      // 재시도 간격
      url
    ]

    return new Promise((resolve) => {
      const ytdlpCommand = process.platform === 'win32' ? './yt-dlp.exe' : 'yt-dlp'
      
      const ytdlp = spawn(ytdlpCommand, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd()
      })

      let stdout = ''
      let stderr = ''
      let title = ''

      ytdlp.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output
        
        // 제목 추출
        const titleMatch = output.match(/\[info\] ([^:]+): Downloading/)
        if (titleMatch) {
          title = titleMatch[1].trim()
        }
      })

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      ytdlp.on('close', async (code) => {
        console.log('yt-dlp 자막 추출 완료. 종료 코드:', code)
        console.log('stdout:', stdout)
        console.log('stderr:', stderr)
        
        if (code === 0) {
          try {
            // 자막 파일 찾기 (yt-dlp가 생성한 .vtt 파일들)
            const tempDir = process.cwd()
            let files: string[] = []
            try {
              files = await fs.readdir(tempDir)
            } catch (error) {
              console.error('디렉토리 읽기 실패:', error)
              resolve({
                success: false,
                error: `디렉토리 읽기 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
              })
              return
            }
            
            // 자막 파일 필터링 - 더 유연한 패턴으로 수정
            const subtitleFiles = files.filter(file => 
              file.endsWith('.vtt') && 
              (file.includes('.ko') || file.includes('.en') || file.includes('auto') || file.includes('live_chat'))
            )

            console.log('찾은 자막 파일들:', subtitleFiles)
            console.log('전체 파일 목록:', files.filter(f => f.includes('.vtt')))

            if (subtitleFiles.length === 0) {
              resolve({
                success: false,
                error: '자막을 찾을 수 없습니다. 이 영상에는 자막이 없거나 지원하지 않는 형식일 수 있습니다.'
              })
              return
            }

            // 첫 번째 자막 파일 읽기 (한국어 우선, 없으면 영어, 없으면 자동생성)
            const priorityFile = subtitleFiles.find(f => f.includes('.ko')) || 
                               subtitleFiles.find(f => f.includes('.en')) ||
                               subtitleFiles.find(f => f.includes('auto')) ||
                               subtitleFiles[0]

            console.log('선택된 자막 파일:', priorityFile)

            const subtitlePath = path.join(tempDir, priorityFile)
            console.log('자막 파일 경로:', subtitlePath)
            
            let subtitleContent: string
            try {
              subtitleContent = await fs.readFile(subtitlePath, 'utf-8')
            } catch (error) {
              console.error('자막 파일 읽기 실패:', error)
              resolve({
                success: false,
                error: `자막 파일 읽기 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
              })
              return
            }
            
            // VTT 형식을 깔끔한 텍스트로 변환
            const cleanSubtitles = this.parseVttToCleanText(subtitleContent)

            // 임시 자막 파일들 정리
            for (const file of subtitleFiles) {
              try {
                await fs.unlink(path.join(tempDir, file))
              } catch {
                // 파일 삭제 실패 무시
              }
            }

            resolve({
              success: true,
              subtitles: cleanSubtitles,
              title: title || 'Unknown'
            })
          } catch (error) {
            resolve({
              success: false,
              error: `자막 처리 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
            })
          }
        } else {
          // 실패했더라도 일부 자막 파일이 다운로드되었을 수 있음
          try {
            const tempDir = process.cwd()
            const files = await fs.readdir(tempDir)
            const subtitleFiles = files.filter(file => 
              file.endsWith('.vtt') && 
              (file.includes('.ko') || file.includes('.en') || file.includes('auto') || file.includes('live_chat'))
            )

            if (subtitleFiles.length > 0) {
              console.log('실패했지만 일부 자막 파일 발견:', subtitleFiles)
              
              const priorityFile = subtitleFiles.find(f => f.includes('.ko')) || 
                                 subtitleFiles.find(f => f.includes('.en')) ||
                                 subtitleFiles.find(f => f.includes('auto')) ||
                                 subtitleFiles[0]

              const subtitlePath = path.join(tempDir, priorityFile)
              const subtitleContent = await fs.readFile(subtitlePath, 'utf-8')
              
              const cleanSubtitles = this.parseVttToCleanText(subtitleContent)

              // 임시 파일들 정리
              for (const file of subtitleFiles) {
                try {
                  await fs.unlink(path.join(tempDir, file))
                } catch {}
              }

              resolve({
                success: true,
                subtitles: cleanSubtitles,
                title: title || 'Unknown'
              })
              return
            }
          } catch (error) {
            console.error('부분 자막 처리 실패:', error)
          }

          // 429 에러인 경우 특별한 메시지
          const errorMessage = stderr.includes('429') || stderr.includes('Too Many Requests')
            ? '현재 YouTube 서버가 혼잡합니다. 10-15분 후 다시 시도해주세요. (서비스 이용자가 많을 때 발생할 수 있습니다)'
            : `자막 추출 실패 (코드: ${code}): ${stderr || '알 수 없는 오류'}`

          resolve({
            success: false,
            error: errorMessage
          })
        }
      })

      ytdlp.on('error', (error) => {
        resolve({
          success: false,
          error: `yt-dlp 실행 실패: ${error.message}`
        })
      })
    })
  }

  static async cleanup(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch {
      // 파일 삭제 실패는 무시
    }
  }
}
