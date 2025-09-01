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
    console.log('비디오 제목:', videoTitle);
    
    // 자막 정보 확인
    if (!info.subtitles && !info.automatic_captions) {
      return { 
        success: false, 
        error: '이 비디오에는 사용 가능한 자막이 없습니다.' 
      };
    }
    
    const availableManual = info.subtitles ? Object.keys(info.subtitles) : [];
    const availableAuto = info.automatic_captions ? Object.keys(info.automatic_captions) : [];
    
    console.log('사용 가능한 자막:', {
      manual: availableManual,
      auto: availableAuto
    });
    
    // 모든 사용 가능한 언어 수집
    const allAvailableLanguages = [...new Set([...availableManual, ...availableAuto])];
    
    // 언어 우선순위 동적 결정
    let subtitleLanguages = [];
    
    // 1. 한국어 관련 언어가 있으면 최우선
    const koreanLangs = ['ko', 'kr', 'ko-KR'];
    const availableKorean = koreanLangs.filter(lang => allAvailableLanguages.includes(lang));
    if (availableKorean.length > 0) {
      subtitleLanguages.push(...availableKorean);
      console.log('한국어 자막 감지됨:', availableKorean);
    }
    
    // 2. 영어 관련 언어 추가
    const englishLangs = ['en', 'en-US', 'en-GB'];
    const availableEnglish = englishLangs.filter(lang => allAvailableLanguages.includes(lang));
    subtitleLanguages.push(...availableEnglish);
    
    // 3. 기타 주요 언어들 추가
    const otherLangs = [
      'ja',                 // 일본어
      'zh', 'zh-Hans', 'zh-Hant', // 중국어
      'es', 'es-ES',        // 스페인어
      'fr',                 // 프랑스어
      'de',                 // 독일어
      'it',                 // 이탈리아어
      'pt', 'pt-BR',        // 포르투갈어
      'ru',                 // 러시아어
      'ar',                 // 아랍어
      'hi',                 // 힌디어
      'th',                 // 태국어
      'vi',                 // 베트남어
      'id',                 // 인도네시아어
      'tr',                 // 터키어
      'pl',                 // 폴란드어
      'nl',                 // 네덜란드어
      'sv',                 // 스웨덴어
      'da',                 // 덴마크어
      'no',                 // 노르웨이어
      'fi'                  // 핀란드어
    ];
    
    // 사용 가능한 언어만 추가
    const availableOthers = otherLangs.filter(lang => allAvailableLanguages.includes(lang));
    subtitleLanguages.push(...availableOthers);
    
    // 중복 제거
    subtitleLanguages = [...new Set(subtitleLanguages)];
    
    console.log('언어 우선순위:', subtitleLanguages.slice(0, 5));
    
    let subtitleData = '';
    
    // 수동 자막 먼저 시도
    if (info.subtitles) {
      for (const lang of subtitleLanguages) {
        if (info.subtitles[lang] && Array.isArray(info.subtitles[lang]) && info.subtitles[lang].length > 0) {
          try {
            const subtitleEntry = info.subtitles[lang][0];
            const subtitleUrl = subtitleEntry?.url;
            if (subtitleUrl) {
              console.log(`수동 자막 URL 찾음 (${lang}):`, subtitleUrl);
              const response = await fetch(subtitleUrl);
              if (response.ok) {
                const rawSubtitles = await response.text();
                subtitleData = cleanSubtitleText(rawSubtitles);
                console.log(`수동 자막 추출 완료 (${lang}): ${subtitleData.length}자`);
                break;
              }
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
        if (info.automatic_captions[lang] && Array.isArray(info.automatic_captions[lang]) && info.automatic_captions[lang].length > 0) {
          try {
            const subtitleEntry = info.automatic_captions[lang][0];
            const subtitleUrl = subtitleEntry?.url;
            if (subtitleUrl) {
              console.log(`자동 자막 URL 찾음 (${lang}):`, subtitleUrl);
              const response = await fetch(subtitleUrl);
              if (response.ok) {
                const rawSubtitles = await response.text();
                subtitleData = cleanSubtitleText(rawSubtitles);
                console.log(`자동 자막 추출 완료 (${lang}): ${subtitleData.length}자`);
                break;
              }
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
        error: '자막을 추출할 수 없습니다. 지원되는 언어의 자막이 없거나 자막이 비활성화되어 있습니다.' 
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
  try {
    // JSON3 형식인지 확인 (YouTube 자동 자막)
    if (rawSubtitles.trim().startsWith('{')) {
      console.log('JSON3 자막 형식 감지, 파싱 시작...');
      const jsonData = JSON.parse(rawSubtitles);
      
      // JSON3 형식에서 텍스트 추출
      let extractedText = '';
      
      if (jsonData.events && Array.isArray(jsonData.events)) {
        for (const event of jsonData.events) {
          if (event.segs && Array.isArray(event.segs)) {
            let eventText = '';
            for (const seg of event.segs) {
              if (seg.utf8 && typeof seg.utf8 === 'string') {
                eventText += seg.utf8;
              }
            }
            if (eventText.trim()) {
              extractedText += eventText.trim() + ' ';
            }
          }
        }
      }
      
      if (extractedText) {
        console.log(`JSON3 파싱 완료: ${extractedText.length}자 추출`);
        // 불필요한 효과음/상황 설명 제거
        const cleanedText = removeAudioDescriptions(extractedText.trim());
        console.log(`효과음 제거 후: ${cleanedText.length}자`);
        return cleanedText;
      }
    }
    
    // VTT/SRT 형식 처리 (기존 로직)
    console.log('VTT/SRT 자막 형식으로 처리...');
    
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
    
    // 불필요한 효과음/상황 설명 제거
    const finalCleaned = removeAudioDescriptions(cleaned);
    console.log(`VTT/SRT 효과음 제거 후: ${finalCleaned.length}자`);
    
    return finalCleaned;
    
            } catch (error) {
    console.error('자막 파싱 오류:', error);
    console.log('원본 자막 앞부분:', rawSubtitles.substring(0, 500));
    
    // 파싱 실패 시 원본 반환 (응급처치)
    return rawSubtitles;
  }
}

// ==================================================================================
// 효과음/상황 설명 제거 함수
// ==================================================================================
function removeAudioDescriptions(text: string): string {
  let cleaned = text;
  
  // 한국어 효과음/상황 설명 제거 패턴
  const koreanPatterns = [
    /\[음악\]/g,
    /\[박수\]/g,
    /\[웃음\]/g,
    /\[웃음소리\]/g,
    /\[환호\]/g,
    /\[환호성\]/g,
    /\[기계음\]/g,
    /\[효과음\]/g,
    /\[소음\]/g,
    /\[노래\]/g,
    /\[멜로디\]/g,
    /\[울음\]/g,
    /\[한숨\]/g,
    /\[침묵\]/g,
    /\[정적\]/g,
    /\[배경음악\]/g,
    /\[BGM\]/g,
    /\[기침\]/g,
    /\[숨소리\]/g,
    /\[발걸음소리\]/g,
    /\[문 여는 소리\]/g,
    /\[문 닫는 소리\]/g,
    /\[전화벨\]/g,
    /\[알람\]/g,
    /\[차량 소음\]/g,
    /\[바람소리\]/g,
    /\[빗소리\]/g,
    /\[천둥소리\]/g
  ];
  
  // 영어 효과음/상황 설명 제거 패턴  
  const englishPatterns = [
    /\[Music\]/gi,
    /\[Applause\]/gi,
    /\[Laughter\]/gi,
    /\[Laughing\]/gi,
    /\[Cheering\]/gi,
    /\[Sound effect\]/gi,
    /\[Background music\]/gi,
    /\[BGM\]/gi,
    /\[Coughing\]/gi,
    /\[Breathing\]/gi,
    /\[Footsteps\]/gi,
    /\[Door opening\]/gi,
    /\[Door closing\]/gi,
    /\[Phone ringing\]/gi,
    /\[Alarm\]/gi,
    /\[Traffic noise\]/gi,
    /\[Wind\]/gi,
    /\[Rain\]/gi,
    /\[Thunder\]/gi,
    /\[Silence\]/gi,
    /\[Pause\]/gi,
    /\[Inaudible\]/gi,
    /\[Unintelligible\]/gi
  ];
  
  // 일반적인 대괄호 안의 설명 (너무 길지 않은 것들만)
  const generalPatterns = [
    /\[[^\]]{1,20}\]/g  // 20자 이하의 대괄호 내용만 제거 (긴 내용은 보존)
  ];
  
  // 한국어 패턴 적용
  koreanPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // 영어 패턴 적용
  englishPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // 일반 패턴 적용 (조심스럽게)
  // generalPatterns.forEach(pattern => {
  //   cleaned = cleaned.replace(pattern, '');
  // });
  
  // 불필요한 기호들 제거
  cleaned = cleaned.replace(/\s*>>\s*/g, ' '); // >> 제거
  cleaned = cleaned.replace(/\s*<<\s*/g, ' '); // << 제거
  cleaned = cleaned.replace(/\s*-->\s*/g, ' '); // --> 제거 (타임스탬프 잔여물)
  cleaned = cleaned.replace(/\s*<--\s*/g, ' '); // <-- 제거
  cleaned = cleaned.replace(/\s*♪\s*/g, ' '); // 음표 기호 제거
  cleaned = cleaned.replace(/\s*♫\s*/g, ' '); // 음표 기호 제거
  
  // 연속된 공백 정리
  cleaned = cleaned.replace(/\s+/g, ' ');
  
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