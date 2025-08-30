import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { YtDlp } from 'ytdlp-nodejs';

// ==================================================================================
// Types and Interfaces
// ==================================================================================
export interface DownloadOptions {
  outputPath?: string;
  quality?: 'highest' | 'lowest' | 'best';
  format?: string;
}

export interface DownloadResult {
  success: boolean;
  error?: string;
  filePath?: string;
  title?: string;
  duration?: number;
  fileSize?: number;
  format?: string;
}

export interface SubtitleResult {
  success: boolean;
  error?: string;
  subtitles?: string;
  title?: string;
}

// ==================================================================================
// Utility Functions
// ==================================================================================
function isYouTubeUrl(url: string): boolean {
  const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/;
  return youtubePattern.test(url);
}

function formatViewCount(views: number): string {
  return views.toLocaleString();
}

// yt-dlp instance (글로벌로 한 번만 생성)
let ytdlpInstance: YtDlp | null = null;

async function getYtDlpInstance(): Promise<YtDlp> {
  if (!ytdlpInstance) {
    ytdlpInstance = new YtDlp();
    
    // yt-dlp가 설치되지 않았다면 자동으로 설치를 시도
    try {
      const isInstalled = await ytdlpInstance.checkInstallationAsync();
      if (!isInstalled) {
        console.log('yt-dlp가 설치되지 않음. 자동 설치 시도...');
        // ytdlp-nodejs는 필요시 자동으로 바이너리를 다운로드합니다
      }
    } catch (error) {
      console.warn('yt-dlp 설치 확인 실패:', error);
    }
  }
  
  return ytdlpInstance;
}

// ==================================================================================
// 핵심 Export 함수 - ytdlp-nodejs 버전
// ==================================================================================
export async function downloadYouTubeVideo(url: string, options: DownloadOptions = {}): Promise<DownloadResult> {
  if (!isYouTubeUrl(url)) {
    return { success: false, error: '유효하지 않은 YouTube URL입니다.' };
  }

  try {
    console.log('YouTube 다운로드 시작 (ytdlp-nodejs):', url);
    
    const ytdlp = await getYtDlpInstance();
    const outputDir = options.outputPath || path.join(os.homedir(), 'Downloads');
    
    // 출력 디렉토리 생성
    await fs.mkdir(outputDir, { recursive: true });
    
    // 비디오 정보 먼저 가져오기
    const info = await ytdlp.getInfoAsync(url);
    if (info._type !== 'video') {
      return { success: false, error: '비디오 정보를 가져올 수 없습니다.' };
    }
    
    const videoTitle = info.title || 'youtube-video';
    const videoDuration = info.duration || 0;
    
    console.log('비디오 정보:', { title: videoTitle, duration: videoDuration });
    
    // 파일명 생성
    const timestamp = Date.now();
    let cleanTitle = videoTitle
      .replace(/[^a-zA-Z0-9가-힣\s\-_]/g, '') // 특수문자 제거
      .replace(/\s+/g, ' ') // 연속 공백을 하나로
      .trim() // 앞뒤 공백 제거
      .substring(0, 40); // 길이 제한
    
    const fileName = cleanTitle ? `${cleanTitle}_${timestamp}.mp4` : `youtube-video_${timestamp}.mp4`;
    const outputPath = path.join(outputDir, fileName);
    
    // 다운로드 옵션 설정
    const downloadOptions = {
      format: options.format || 'best[ext=mp4][height<=2160]/best[ext=mp4][height<=1080]/best[ext=mp4]/best',
      output: outputPath,
      mergeOutputFormat: 'mp4',
      onProgress: (progress: any) => {
        if (progress.percent) {
          console.log(`다운로드 진행률: ${progress.percent}%`);
        }
      }
    };
    
    // 실제 다운로드 실행
    const result = await ytdlp.downloadAsync(url, downloadOptions);
    
    console.log('다운로드 완료:', result);
    
    // 파일 정보 확인
    try {
      const stats = await fs.stat(outputPath);
      
      return {
        success: true,
        filePath: outputPath,
        title: videoTitle,
        duration: videoDuration,
        fileSize: stats.size,
        format: '.mp4'
      };
    } catch (statError) {
      console.error('파일 확인 실패:', statError);
      return { success: false, error: '다운로드된 파일을 찾을 수 없습니다.' };
    }
    
  } catch (error: any) {
    console.error('YouTube 다운로드 오류:', error);
    
    let errorMessage = '알 수 없는 오류';
    if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    return { success: false, error: `다운로드 실패: ${errorMessage}` };
  }
}

// ==================================================================================
// YouTube 자막 추출 함수 - ytdlp-nodejs 버전
// ==================================================================================
export async function extractYouTubeSubtitles(url: string): Promise<SubtitleResult> {
  if (!isYouTubeUrl(url)) {
    return { success: false, error: '유효하지 않은 YouTube URL입니다.' };
  }

  try {
    console.log('YouTube 자막 추출 시작 (ytdlp-nodejs):', url);
    
    const ytdlp = await getYtDlpInstance();
    
    // 비디오 정보 가져오기 (자막 정보 포함)
    const info = await ytdlp.getInfoAsync(url);
    if (info._type !== 'video') {
      return { success: false, error: '비디오 정보를 가져올 수 없습니다.' };
    }
    
    const videoTitle = info.title || 'YouTube 비디오';
    
    // 자막 정보 확인
    if (!info.subtitles && !info.automatic_captions) {
      return { 
        success: false, 
        error: '이 비디오에는 사용 가능한 자막이 없습니다.' 
      };
    }
    
    // 한국어 자막 우선, 그 다음 영어, 자동 생성 자막 순으로 시도
    let subtitleData = '';
    const subtitleLanguages = ['ko', 'kr', 'en', 'en-US'];
    
    // 수동 자막 먼저 시도
    if (info.subtitles) {
      for (const lang of subtitleLanguages) {
        if (info.subtitles[lang]) {
          try {
            // 첫 번째 자막 포맷 사용 (보통 VTT 또는 SRT)
            const subtitleUrl = info.subtitles[lang][0]?.url;
            if (subtitleUrl) {
              const response = await fetch(subtitleUrl);
              const rawSubtitles = await response.text();
              subtitleData = cleanSubtitleText(rawSubtitles);
              console.log(`수동 자막 추출 완료 (${lang}):`, subtitleData.substring(0, 100) + '...');
              break;
            }
          } catch (error) {
            console.warn(`수동 자막 추출 실패 (${lang}):`, error);
          }
        }
      }
    }
    
    // 자동 생성 자막 시도 (수동 자막이 없는 경우)
    if (!subtitleData && info.automatic_captions) {
      for (const lang of subtitleLanguages) {
        if (info.automatic_captions[lang]) {
          try {
            const subtitleUrl = info.automatic_captions[lang][0]?.url;
            if (subtitleUrl) {
              const response = await fetch(subtitleUrl);
              const rawSubtitles = await response.text();
              subtitleData = cleanSubtitleText(rawSubtitles);
              console.log(`자동 자막 추출 완료 (${lang}):`, subtitleData.substring(0, 100) + '...');
              break;
            }
          } catch (error) {
            console.warn(`자동 자막 추출 실패 (${lang}):`, error);
          }
        }
      }
    }
    
    if (!subtitleData) {
    return {
      success: false,
        error: '자막을 추출할 수 없습니다. 지원되는 언어(한국어, 영어)의 자막이 없습니다.' 
      };
    }
    
    return {
      success: true,
      subtitles: subtitleData,
      title: videoTitle
    };
    
  } catch (error: any) {
    console.error('YouTube 자막 추출 오류:', error);
    
    let errorMessage = '알 수 없는 오류';
    if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    return { success: false, error: `자막 추출 실패: ${errorMessage}` };
  }
}

// ==================================================================================
// 자막 텍스트 정리 함수
// ==================================================================================
function cleanSubtitleText(rawSubtitles: string): string {
  // VTT 형식의 헤더 제거
  let cleaned = rawSubtitles.replace(/^WEBVTT\n/, '');
  
  // SRT/VTT 타임스탬프 제거 (여러 형식 지원)
  cleaned = cleaned.replace(/^\d+\n/gm, ''); // SRT 번호
  cleaned = cleaned.replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/g, ''); // 타임스탬프
  cleaned = cleaned.replace(/\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}[.,]\d{3}/g, ''); // 짧은 타임스탬프
  
  // VTT 스타일 태그 제거
  cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, ''); // HTML 태그
  cleaned = cleaned.replace(/\{[^}]*\}/g, ''); // CSS 스타일
  
  // 연속된 줄바꿈을 하나로 통합
  cleaned = cleaned.replace(/\n{2,}/g, '\n');
  
  // 앞뒤 공백 제거
  cleaned = cleaned.trim();
  
  return cleaned;
}

// ==================================================================================
// 파일 정리 함수
// ==================================================================================
export async function cleanupVideoFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    console.log('임시 파일 정리 완료:', filePath);
          } catch (error) {
    console.warn('파일 정리 실패:', error);
  }
}