declare module 'ytdlp-nodejs' {
  export class YtDlp {
    constructor(options?: { binaryPath?: string; ffmpegPath?: string });
    checkInstallationAsync(options?: { ffmpeg?: boolean }): Promise<boolean>;
    getInfoAsync(url: string): Promise<VideoInfo | PlaylistInfo>;
    downloadAsync(url: string, options?: DownloadOptions): Promise<any>;
    getTitleAsync(url: string): Promise<string>;
    getThumbnailsAsync(url: string): Promise<VideoThumbnail[]>;
  }

  interface VideoInfo {
    _type: 'video';
    title?: string;
    duration?: number;
    subtitles?: Record<string, SubtitleFormat[]>;
    automatic_captions?: Record<string, SubtitleFormat[]>;
    [key: string]: any;
  }

  interface PlaylistInfo {
    _type: 'playlist';
    [key: string]: any;
  }

  interface SubtitleFormat {
    url: string;
    ext: string;
    [key: string]: any;
  }

  interface VideoThumbnail {
    url: string;
    [key: string]: any;
  }

  interface DownloadOptions {
    format?: string;
    output?: string;
    mergeOutputFormat?: string;
    onProgress?: (progress: any) => void;
    [key: string]: any;
  }
}
