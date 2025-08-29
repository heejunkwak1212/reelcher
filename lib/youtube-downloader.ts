import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

// ==================================================================================
// 인터페이스 정의
// ==================================================================================
export interface DownloadOptions {
  format?: string;
  outputPath?: string;
  cookiePath?: string;
}

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
  title?: string;
  duration?: number;
  fileSize?: number;
  format?: string;
}

// ==================================================================================
// 헬퍼 함수
// ==================================================================================
function isYouTubeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

async function handleSuccessfulDownload(outputDir: string, timestamp: number): Promise<DownloadResult> {
  // 현재 디렉토리에서 최근 다운로드된 파일 찾기
  const currentDir = process.cwd();
  const files = await fs.readdir(currentDir);
  
  // 최근 30초 내에 생성된 비디오 파일 찾기
  const recentFiles = [];
  for (const file of files) {
    if (file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mkv')) {
      const filePath = path.join(currentDir, file);
      try {
        const stats = await fs.stat(filePath);
        const fileAge = Date.now() - stats.mtime.getTime();
        if (fileAge < 30000) { // 30초 이내
          recentFiles.push({ name: file, path: filePath, size: stats.size, mtime: stats.mtime });
        }
      } catch (e) {
        console.log('파일 stat 실패:', file);
      }
    }
  }

  console.log('최근 다운로드된 파일들:', recentFiles.map(f => f.name));

  if (recentFiles.length === 0) {
    throw new Error('다운로드된 파일을 찾을 수 없습니다.');
  }

  // 가장 최근 파일 선택
  const selectedFile = recentFiles.reduce((latest, current) => 
    current.mtime > latest.mtime ? current : latest
  );

  // 다운로드 폴더로 파일 이동
  const finalFilePath = path.join(outputDir, `video_${timestamp}.mp4`);
  await fs.rename(selectedFile.path, finalFilePath);
  console.log('파일 이동 완료:', finalFilePath);
  
  const stats = await fs.stat(finalFilePath);

  return {
    success: true,
    filePath: finalFilePath,
    title: path.basename(selectedFile.name, path.extname(selectedFile.name)),
    duration: 0,
    fileSize: stats.size,
    format: path.extname(selectedFile.name)
  };
}

// ==================================================================================
// 핵심 Export 함수 - yt-dlp-exec 최적화 버전
// ==================================================================================
export async function downloadYouTubeVideo(url: string, options: DownloadOptions = {}): Promise<DownloadResult> {
  if (!isYouTubeUrl(url)) {
    return { success: false, error: '유효하지 않은 YouTube URL입니다.' };
  }

  // OS 공식 임시 폴더 사용 (가장 안정적이고 표준적)
  const tempDir = os.tmpdir();
  const outputDir = options.outputPath || path.join(os.homedir(), 'Downloads');
  const timestamp = Date.now();
  // 파일명을 더 단순하게
  const outputTemplate = `${path.join(outputDir, 'video_' + timestamp)}.%(ext)s`;
  
  try {
    await fs.mkdir(outputDir, { recursive: true });
    console.log('YouTube 다운로드 시작:', url);
    console.log('임시 폴더:', tempDir);
    console.log('최종 저장 폴더:', outputDir);

    // yt-dlp 직접 실행 (인코딩 문제 해결)
    const ytdlpBinary = path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');
    
    return new Promise((resolve) => {
      const args = [
        url,
        '--format', '18', // 360p MP4 (안정적, 비디오+오디오)
        '--restrict-filenames',
        '--no-warnings',
        '--encoding', 'utf-8' // 인코딩 명시적 지정
      ];

      console.log('yt-dlp 실행:', ytdlpBinary, args.join(' '));

      const childProcess = spawn(ytdlpBinary, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      childProcess.on('close', async (code: number | null) => {
        console.log('yt-dlp 종료 코드:', code);
        console.log('stdout:', stdout);
        console.log('stderr:', stderr);

        if (code === 0) {
          try {
            // 성공적으로 다운로드된 경우 파일 찾기
            const downloadResult = await handleSuccessfulDownload(outputDir, timestamp);
            resolve(downloadResult);
          } catch (error) {
            resolve({ success: false, error: `파일 처리 실패: ${error}` });
          }
        } else {
          resolve({ success: false, error: `yt-dlp 실행 실패 (코드: ${code}): ${stderr}` });
        }
      });

      childProcess.on('error', (error: Error) => {
        resolve({ success: false, error: `프로세스 실행 실패: ${error.message}` });
      });
    });

  } catch (error: any) {
    console.error('다운로드 중 오류 발생:', error);
    
    // yt-dlp 에러 메시지 더 자세히 분석
    let errorMessage = '알 수 없는 오류';
    if (error?.stderr) {
      console.error('yt-dlp stderr:', error.stderr);
      errorMessage = `yt-dlp 오류: ${error.stderr}`;
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    return { success: false, error: `다운로드 실패: ${errorMessage}` };
  }
}

export async function cleanupVideoFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    console.log('임시 파일 정리 완료:', filePath);
            } catch (error) {
    console.warn('파일 정리 실패:', error);
  }
}