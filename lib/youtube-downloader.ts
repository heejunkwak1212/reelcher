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

export class YouTubeDownloader {
  private static isYouTubeUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')
    } catch {
      return false
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
          
          const lines = output.split('\n').filter(line => line.trim())
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

  static async cleanup(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch {
      // 파일 삭제 실패는 무시
    }
  }
}
