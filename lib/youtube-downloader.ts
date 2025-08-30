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

async function handleSuccessfulDownload(outputDir: string, timestamp: number, videoTitle?: string, videoDuration?: number): Promise<DownloadResult> {
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

  // 병합된 파일 우선 선택 (f788+f251 -> 완전한 파일)
  // 1. 병합된 파일이 있는지 확인 (확장자가 mp4이고 f로 시작하지 않는 파일)
  const mergedFiles = recentFiles.filter(f => 
    f.name.endsWith('.mp4') && !f.name.includes('.f')
  );
  
  // 2. 병합된 파일이 있으면 우선 선택
  let selectedFile;
  if (mergedFiles.length > 0) {
    selectedFile = mergedFiles.reduce((latest, current) => 
      current.mtime > latest.mtime ? current : latest
    );
  } else {
    // 3. 병합된 파일이 없으면 비디오 파일 우선 선택 (f788.mp4 같은)
    const videoFiles = recentFiles.filter(f => 
      f.name.endsWith('.mp4') && f.name.includes('.f')
    );
    
    if (videoFiles.length > 0) {
      selectedFile = videoFiles.reduce((latest, current) => 
        current.size > latest.size ? current : latest // 크기가 큰 파일 선택
      );
    } else {
      // 4. 마지막으로 가장 최근 파일 선택
      selectedFile = recentFiles.reduce((latest, current) => 
        current.mtime > latest.mtime ? current : latest
      );
    }
  }

  // 다운로드 폴더로 파일 이동
  const finalFilePath = path.join(outputDir, `video_${timestamp}.mp4`);
  await fs.rename(selectedFile.path, finalFilePath);
  console.log('파일 이동 완료:', finalFilePath);
  
  const stats = await fs.stat(finalFilePath);

                  return {
    success: true,
    filePath: finalFilePath,
    title: videoTitle || path.basename(selectedFile.name, path.extname(selectedFile.name)),
    duration: videoDuration || 0,
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

  // yt-dlp-exec 패키지 존재 여부 확인
  try {
    require.resolve('yt-dlp-exec');
  } catch (error) {
    console.warn('yt-dlp-exec 패키지를 찾을 수 없음:', error);
    return { 
      success: false, 
      error: 'YouTube 다운로드 기능이 현재 환경에서 지원되지 않습니다. 개발 환경에서만 사용 가능합니다.' 
    };
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

    // yt-dlp 직접 실행 (크로스 플랫폼 호환)
    const isWindows = process.platform === 'win32';
    const ytdlpBinary = path.join(
      process.cwd(), 
      'node_modules', 
      'yt-dlp-exec', 
      'bin', 
      isWindows ? 'yt-dlp.exe' : 'yt-dlp'
    );

    // 바이너리 파일 존재 여부 확인
    try {
      await fs.access(ytdlpBinary);
    } catch (accessError) {
      console.warn('yt-dlp 바이너리를 찾을 수 없음:', ytdlpBinary);
      return { 
        success: false, 
        error: 'YouTube 다운로드 바이너리가 설치되지 않았습니다. 개발 환경에서만 사용 가능합니다.' 
      };
    }

        return new Promise((resolve) => {
      // 1단계: 메타데이터 추출
      const metaArgs = [
        url,
        '--print', 'title',
        '--print', 'duration', 
        '--no-warnings',
        '--encoding', 'utf-8'
      ];

      console.log('yt-dlp 메타데이터 추출:', ytdlpBinary, metaArgs.join(' '));

      const metaProcess = spawn(ytdlpBinary, metaArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        timeout: 30000 // 30초 타임아웃 추가 (메타데이터는 더 빠름)
      });

      let metaStdout = '';
      let metaStderr = '';

      metaProcess.stdout?.on('data', (data: Buffer) => {
        metaStdout += data.toString();
      });

      metaProcess.stderr?.on('data', (data: Buffer) => {
        metaStderr += data.toString();
      });

      metaProcess.on('close', async (metaCode: number | null) => {
        console.log('메타데이터 추출 완료:', metaCode);
        
        let videoTitle = '';
        let videoDuration = 0;
        
        if (metaCode === 0) {
          const lines = metaStdout.trim().split('\n');
          videoTitle = lines[0] || '';
          videoDuration = parseFloat(lines[1]) || 0;
          console.log('추출된 메타데이터:', { title: videoTitle, duration: videoDuration });
        }

        // 2단계: 실제 다운로드
        const downloadArgs = [
          url,
          '--format', 'best[ext=mp4][height<=2160][acodec!=none]/best[ext=mp4][height<=1080][acodec!=none]/22/18/best[acodec!=none]',
          '--merge-output-format', 'mp4',
          '--restrict-filenames',
          '--no-warnings',
          '--encoding', 'utf-8'
        ];

        console.log('yt-dlp 다운로드 시작:', ytdlpBinary, downloadArgs.join(' '));

        const downloadProcess = spawn(ytdlpBinary, downloadArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
          timeout: 60000 // 60초 타임아웃 추가
        });

        let downloadStdout = '';
        let downloadStderr = '';

        downloadProcess.stdout?.on('data', (data: Buffer) => {
          downloadStdout += data.toString();
        });

        downloadProcess.stderr?.on('data', (data: Buffer) => {
          downloadStderr += data.toString();
        });

        downloadProcess.on('close', async (downloadCode: number | null) => {
          console.log('yt-dlp 다운로드 종료 코드:', downloadCode);
          console.log('다운로드 stdout:', downloadStdout);
          console.log('다운로드 stderr:', downloadStderr);

          if (downloadCode === 0) {
            try {
              const downloadResult = await handleSuccessfulDownload(outputDir, timestamp, videoTitle, videoDuration);
              resolve(downloadResult);
            } catch (error) {
              resolve({ success: false, error: `파일 처리 실패: ${error}` });
            }
          } else {
            resolve({ success: false, error: `yt-dlp 다운로드 실패 (코드: ${downloadCode}): ${downloadStderr}` });
          }
        });

        downloadProcess.on('error', (error: Error) => {
          resolve({ success: false, error: `다운로드 프로세스 실행 실패: ${error.message}` });
        });
      });

      metaProcess.on('error', (error: Error) => {
        resolve({ success: false, error: `메타데이터 추출 실패: ${error.message}` });
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
    console.log('파일 정리 시작:', filePath);
    await fs.unlink(filePath);
    console.log('파일 정리 완료:', filePath);
  } catch (error) {
    console.warn('파일 정리 실패:', error);
  }
}

// ==================================================================================
// YouTube 자막 추출 함수
// ==================================================================================
export async function extractYouTubeSubtitles(url: string): Promise<SubtitleResult> {
  if (!isYouTubeUrl(url)) {
    return { success: false, error: '유효하지 않은 YouTube URL입니다.' };
  }

  // yt-dlp-exec 패키지 존재 여부 확인
  try {
    require.resolve('yt-dlp-exec');
  } catch (error) {
    console.warn('yt-dlp-exec 패키지를 찾을 수 없음:', error);
    return { 
      success: false, 
      error: 'YouTube 자막 추출 기능이 현재 환경에서 지원되지 않습니다. 개발 환경에서만 사용 가능합니다.' 
    };
  }

  try {
    console.log('YouTube 자막 추출 시작:', url);

    // yt-dlp 직접 실행으로 자막 추출
    const isWindows = process.platform === 'win32';
    const ytdlpBinary = path.join(
      process.cwd(),
      'node_modules',
      'yt-dlp-exec',
      'bin',
      isWindows ? 'yt-dlp.exe' : 'yt-dlp'
    );

    // 바이너리 파일 존재 여부 확인
    try {
      await fs.access(ytdlpBinary);
    } catch (accessError) {
      console.warn('yt-dlp 바이너리를 찾을 수 없음:', ytdlpBinary);
      return { 
        success: false, 
        error: 'YouTube 자막 추출 바이너리가 설치되지 않았습니다. 개발 환경에서만 사용 가능합니다.' 
      };
    }

    return new Promise((resolve) => {
      // 자막만 추출하는 명령어
      const subtitleArgs = [
        url,
        '--write-subs',            // 자막 다운로드
        '--write-auto-subs',       // 자동 생성 자막도 포함
        '--sub-langs', 'ko,en',    // 한국어, 영어 자막 우선
        '--skip-download',         // 비디오는 다운로드하지 않음
        '--print', 'title',        // 제목도 함께 추출
        '--no-warnings',
        '--encoding', 'utf-8'
      ];

      console.log('yt-dlp 자막 추출 명령:', ytdlpBinary, subtitleArgs.join(' '));

      const subtitleProcess = spawn(ytdlpBinary, subtitleArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        timeout: 60000 // 60초 타임아웃
      });

      let stdout = '';
      let stderr = '';

      subtitleProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      subtitleProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      subtitleProcess.on('close', async (code: number | null) => {
        console.log('yt-dlp 자막 추출 종료 코드:', code);
        console.log('자막 추출 stdout:', stdout);
        console.log('자막 추출 stderr:', stderr);

        if (code === 0) {
          try {
            // 현재 디렉토리에서 다운로드된 자막 파일 찾기
            const currentDir = process.cwd();
            const files = await fs.readdir(currentDir);
            
            // .vtt 또는 .srt 파일 찾기
            const subtitleFiles = files.filter(file => 
              (file.endsWith('.vtt') || file.endsWith('.srt')) && 
              !file.includes('.live_chat.')  // 라이브 채팅 제외
            );

            console.log('발견된 자막 파일들:', subtitleFiles);

            if (subtitleFiles.length === 0) {
              resolve({ 
                success: false, 
                error: '자막 파일을 찾을 수 없습니다. 이 영상에는 자막이 없을 수 있습니다.' 
              });
              return;
            }

            // 첫 번째 자막 파일 읽기
            const subtitleFile = subtitleFiles[0];
            const subtitlePath = path.join(currentDir, subtitleFile);
            const subtitleContent = await fs.readFile(subtitlePath, 'utf-8');

            // 자막 파일 정리
            await fs.unlink(subtitlePath);
            console.log('자막 파일 정리 완료:', subtitlePath);

            // VTT 또는 SRT 형식을 일반 텍스트로 변환
            const cleanSubtitles = cleanSubtitleText(subtitleContent);
            
            // 제목 추출
            const lines = stdout.trim().split('\n');
            const title = lines.find(line => line.trim() && !line.includes('Downloading')) || '';

            resolve({
              success: true,
              subtitles: cleanSubtitles,
              title: title.trim()
            });

          } catch (error) {
            console.error('자막 파일 처리 오류:', error);
            resolve({ 
              success: false, 
              error: `자막 파일 처리 실패: ${error}` 
            });
          }
        } else {
          console.error('yt-dlp 자막 추출 실패:', stderr);
          
          // 구체적인 오류 메시지 제공
          let errorMessage = '자막 추출에 실패했습니다.';
          if (stderr.includes('No such file or directory')) {
            errorMessage = 'yt-dlp를 찾을 수 없습니다.';
          } else if (stderr.includes('video unavailable') || stderr.includes('Private video')) {
            errorMessage = '비공개 영상이거나 사용할 수 없는 영상입니다.';
          } else if (stderr.includes('No subtitles')) {
            errorMessage = '이 영상에는 자막이 없습니다.';
          }
          
          resolve({ 
            success: false, 
            error: errorMessage 
          });
        }
      });

      subtitleProcess.on('error', (error: Error) => {
        console.error('자막 추출 프로세스 실행 실패:', error);
        resolve({ 
          success: false, 
          error: `자막 추출 프로세스 실행 실패: ${error.message}` 
        });
      });
    });

  } catch (error: any) {
    console.error('자막 추출 중 오류 발생:', error);
    return { 
      success: false, 
      error: `자막 추출 실패: ${error.message}` 
    };
  }
}

// 자막 텍스트 정리 함수 (VTT/SRT 형식에서 일반 텍스트로)
function cleanSubtitleText(subtitleContent: string): string {
  if (!subtitleContent) return '';

  let lines = subtitleContent.split('\n');
  let cleanLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // VTT 헤더 제거
    if (line === 'WEBVTT' || line.startsWith('Kind:') || line.startsWith('Language:')) {
      continue;
    }
    
    // 타임스탬프 라인 제거 (SRT 숫자, VTT 타임스탬프)
    if (/^\d+$/.test(line) || /\d{2}:\d{2}:\d{2}/.test(line)) {
      continue;
    }
    
    // 빈 줄 제거
    if (line === '') {
      continue;
    }
    
    // HTML 태그 제거
    const cleanLine = line.replace(/<[^>]*>/g, '').trim();
    
    if (cleanLine && !cleanLines.includes(cleanLine)) {
      cleanLines.push(cleanLine);
    }
  }

  return cleanLines.join('\n');
}