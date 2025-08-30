declare module 'ytdlp-nodejs' {
  export class YtDlp {
    constructor(options?: { binaryPath?: string; ffmpegPath?: string });
    checkInstallationAsync(options?: { ffmpeg?: boolean }): Promise<boolean>;
    checkInstallation(options?: { ffmpeg?: boolean }): boolean;
    getInfoAsync(url: string): Promise<VideoInfo | PlaylistInfo>;
    downloadAsync(url: string, options?: DownloadOptions): Promise<any>;
    getTitleAsync(url: string): Promise<string>;
    getThumbnailsAsync(url: string): Promise<VideoThumbnail[]>;
    getFileAsync(url: string, options?: FileDownloadOptions): Promise<File>;
    execAsync(url: string, options?: any): Promise<any>;
    stream(url: string, options?: any): StreamResult;
    download(url: string, options?: DownloadOptions): any;
    exec(url: string, options?: any): any;
    downloadFFmpeg(): Promise<void>;
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

  interface FileDownloadOptions {
    format?: {
      filter?: string;
      type?: string;
      quality?: string;
    };
    filename?: string;
    onProgress?: (progress: any) => void;
    [key: string]: any;
  }

  interface StreamResult {
    pipe(destination: any): any;
    pipeAsync(destination: any): Promise<any>;
  }

  interface File {
    buffer: Buffer;
    filename: string;
    [key: string]: any;
  }
}
