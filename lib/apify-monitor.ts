// lib/apify-monitor.ts
export interface ApifyRunInfo {
  id: string;
  actId: string;
  userId: string;
  actorTaskId?: string;
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED';
  startedAt: string;
  finishedAt?: string;
  buildId: string;
  buildNumber: string;
  exitCode?: number;
  defaultDatasetId: string;
  defaultKeyValueStoreId: string;
  defaultRequestQueueId: string;
  stats: {
    inputBodyLen: number;
    restartCount: number;
    resurrectCount: number;
    memAvgBytes: number;
    memMaxBytes: number;
    memCurrentBytes: number;
    cpuAvgUsage: number;
    cpuMaxUsage: number;
    cpuCurrentUsage: number;
    netRxBytes: number;
    netTxBytes: number;
    durationMillis: number;
    runTimeSecs: number;
    metamorph: number;
    computeUnits: number;
  };
  options: {
    build: string;
    memoryMbytes: number;
    timeoutSecs: number;
  };
  usage?: {
    ACTOR_COMPUTE_UNITS: number;
    DATASET_READS: number;
    DATASET_WRITES: number;
    KEY_VALUE_STORE_READS: number;
    KEY_VALUE_STORE_WRITES: number;
    REQUEST_QUEUE_READS: number;
    REQUEST_QUEUE_WRITES: number;
    DATA_TRANSFER_INTERNAL_GBYTES: number;
    DATA_TRANSFER_EXTERNAL_GBYTES: number;
    PROXY_RESIDENTIAL_TRANSFER_GBYTES: number;
    PROXY_SERP_TRANSFER_GBYTES: number;
  };
}

export interface ApifyAccountInfo {
  id: string;
  username: string;
  email: string;
  plan: string;
  proxy: {
    password: string;
    groups: string[];
  };
  limits: {
    maxActorMemoryMbytes: number;
    maxCombinedActorMemoryMbytes: number;
    maxConcurrentActorRuns: number;
  };
}

export interface ApifyUsageInfo {
  currentMemoryUsage: number;
  maxMemoryAllowed: number;
  usagePercentage: number;
  runningActorsCount: number;
  runningActors: ApifyRunInfo[];
  accountInfo: ApifyAccountInfo;
}

export interface DailyActorDetail {
  actorId: string;
  actorName: string;
  runCount: number;
  totalComputeUnits: number;
  totalCostUSD: number;
  totalCostKRW: number;
  runs: ApifyRunInfo[];
}

export interface ApifyUsageStats {
  daily: Array<{
    date: string;
    computeUnits: number;
    memoryUsage: number;
    actorRuns: number;
    totalCostUSD: number;
    totalCostKRW: number;
    actorDetails: DailyActorDetail[];
  }>;
  hourly: Array<{
    hour: string;
    computeUnits: number;
    memoryUsage: number;
    actorRuns: number;
  }>;
  totalComputeUnits: number;
}

class ApifyMonitor {
  private token: string;
  private baseUrl = 'https://api.apify.com/v2';

  constructor(token: string) {
    this.token = token;
  }

  private async apiRequest<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Apify API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || data;
  }

  async getAccountInfo(): Promise<ApifyAccountInfo> {
    return this.apiRequest<ApifyAccountInfo>('/users/me');
  }

  async getRunningActors(): Promise<ApifyRunInfo[]> {
    const response = await this.apiRequest<{ items: ApifyRunInfo[] }>('/actor-runs?status=RUNNING&limit=1000');
    return response.items || [];
  }

  async getRecentRuns(limit = 100): Promise<ApifyRunInfo[]> {
    const response = await this.apiRequest<{ items: ApifyRunInfo[] }>(`/actor-runs?limit=${limit}&desc=1`);
    return response.items || [];
  }

  // 개별 실행의 상세 비용 계산
  // 액터 ID를 사용자 친화적 이름으로 변환
  getActorDisplayName(actId: string): string {
    const actorNames: { [key: string]: string } = {
      // Instagram 액터들 (새 계정)
      'bold_argument~instagram-hashtag-scraper-task': 'Instagram Hashtag Scraper',
      'bold_argument~instagram-scraper-task': 'Instagram Scraper (Details)',
      'bold_argument~instagram-scraper-task-2': 'Instagram Scraper (Profile)',
      'bold_argument~instagram-profile-scraper-task': 'Instagram Profile Scraper',
      'Jn0TcZARDzngD3AEV': 'Instagram Hashtag Scraper',
      'lqbfmuw6hgEZjTKJl': 'Instagram Scraper',
      '9nSdZ5pYWVTU1Gcau': 'Instagram Profile Scraper',
      
      // TikTok 액터들 (새 계정)
      'bold_argument~tiktok-scraper-task': 'TikTok Profile Scraper',
      'bold_argument~tiktok-scraper-task-2': 'TikTok Keyword Scraper',
      'edRdjZboRnLv1tb68': 'TikTok Profile Scraper',
      'U1rBeH55rsgH0HS9r': 'TikTok Keyword Scraper',
      
      // 자막 추출 액터 (새 계정)
      'bold_argument~tiktok-instagram-facebook-transcriber-task': 'Subtitle Extractor',
      'BHgesiUiheIenGwOy': 'Subtitle Extractor',
      
      // 구 액터들 (호환성 유지)
      'upscale_jiminy~instagram-hashtag-scraper-task': 'Instagram Hashtag Scraper (Old)',
      'upscale_jiminy~instagram-scraper-task': 'Instagram Scraper (Old)',
      'upscale_jiminy~instagram-profile-scraper-task': 'Instagram Profile Scraper (Old)',
      'interesting_dingo~tiktok-scraper-task': 'TikTok Profile Scraper (Old)',
      'interesting_dingo~tiktok-scraper-task-2': 'TikTok Keyword Scraper (Old)',
      'interesting_dingo~tiktok-instagram-facebook-transcriber-task': 'Subtitle Extractor (Old)',
      
      // YouTube는 Google API 사용 (Apify 아님)
      'youtube-data-v3': 'YouTube Data API v3',
    };
    
    return actorNames[actId] || actId;
  }

  calculateRunCost(run: ApifyRunInfo): {
    computeUnits: number;
    totalCostUSD: number;
    totalCostKRW: number;
    breakdown: {
      computeUnits: { amount: number; cost: number };
      dataTransferExternal: { amount: number; cost: number };
      dataTransferInternal: { amount: number; cost: number };
      datasetReads: { amount: number; cost: number };
      datasetWrites: { amount: number; cost: number };
      keyValueStoreReads: { amount: number; cost: number };
      keyValueStoreWrites: { amount: number; cost: number };
      requestQueueReads: { amount: number; cost: number };
      requestQueueWrites: { amount: number; cost: number };
    };
  } {
    const usage = run.usage || {};
    
    // Apify 요금표 (실제 관찰된 값 기준)
    const prices = {
      computeUnit: 0.25, // $0.25 per CU (FREE/GOLD 플랜)
      dataTransferExternal: 0.18, // $0.18 per GB (GOLD 플랜)
      dataTransferInternal: 0.04, // $0.04 per GB (GOLD 플랜)
      datasetReads: 0.00032, // $0.00032 per 1,000 reads (GOLD 플랜)
      datasetWrites: 0.004, // $0.004 per 1,000 writes (GOLD 플랜)
      keyValueStoreReads: 0.004, // $0.004 per 1,000 reads (GOLD 플랜)
      keyValueStoreWrites: 0.04, // $0.04 per 1,000 writes (GOLD 플랜)
      requestQueueReads: 0.0032, // $0.0032 per 1,000 reads (GOLD 플랜)
      requestQueueWrites: 0.016, // $0.016 per 1,000 writes (GOLD 플랜)
    };

    // 컴퓨트 유닛 계산: 실행 시간과 메모리 기반
    const runTimeHours = run.stats?.runTimeSecs ? run.stats.runTimeSecs / 3600 : 0;
    const memoryGB = run.options?.memoryMbytes ? run.options.memoryMbytes / 1024 : 0;
    const computedCU = runTimeHours * memoryGB; // 실제 CU 계산: 시간 × 메모리(GB)
    
    const computeUnits = (usage as any).ACTOR_COMPUTE_UNITS || run.stats?.computeUnits || computedCU;
    
    const breakdown = {
      computeUnits: {
        amount: computeUnits,
        cost: computeUnits * prices.computeUnit
      },
      dataTransferExternal: {
        amount: ((usage as any).DATA_TRANSFER_EXTERNAL || 0) / (1024 * 1024 * 1024), // bytes to GB
        cost: (((usage as any).DATA_TRANSFER_EXTERNAL || 0) / (1024 * 1024 * 1024)) * prices.dataTransferExternal
      },
      dataTransferInternal: {
        amount: ((usage as any).DATA_TRANSFER_INTERNAL || 0) / (1024 * 1024 * 1024), // bytes to GB
        cost: (((usage as any).DATA_TRANSFER_INTERNAL || 0) / (1024 * 1024 * 1024)) * prices.dataTransferInternal
      },
      datasetReads: {
        amount: (usage as any).DATASET_READS || 0,
        cost: (((usage as any).DATASET_READS || 0) / 1000) * prices.datasetReads
      },
      datasetWrites: {
        amount: (usage as any).DATASET_WRITES || 0,
        cost: (((usage as any).DATASET_WRITES || 0) / 1000) * prices.datasetWrites
      },
      keyValueStoreReads: {
        amount: (usage as any).KEY_VALUE_STORE_READS || 0,
        cost: (((usage as any).KEY_VALUE_STORE_READS || 0) / 1000) * prices.keyValueStoreReads
      },
      keyValueStoreWrites: {
        amount: (usage as any).KEY_VALUE_STORE_WRITES || 0,
        cost: (((usage as any).KEY_VALUE_STORE_WRITES || 0) / 1000) * prices.keyValueStoreWrites
      },
      requestQueueReads: {
        amount: (usage as any).REQUEST_QUEUE_READS || 0,
        cost: (((usage as any).REQUEST_QUEUE_READS || 0) / 1000) * prices.requestQueueReads
      },
      requestQueueWrites: {
        amount: (usage as any).REQUEST_QUEUE_WRITES || 0,
        cost: (((usage as any).REQUEST_QUEUE_WRITES || 0) / 1000) * prices.requestQueueWrites
      }
    };

    const totalCostUSD = Object.values(breakdown).reduce((sum, item) => sum + item.cost, 0);
    const totalCostKRW = totalCostUSD * 1340; // 환율 적용

    return {
      computeUnits,
      totalCostUSD,
      totalCostKRW,
      breakdown
    };
  }

  async getCurrentUsage(): Promise<ApifyUsageInfo> {
    const [accountInfo, runningActors] = await Promise.all([
      this.getAccountInfo(),
      this.getRunningActors(),
    ]);

    const currentMemoryUsage = runningActors.reduce((total, run) => {
      return total + (run.options?.memoryMbytes || 0);
    }, 0);

    // Apify 계정에서 직접 가져온 실제 메모리 제한 사용
    let maxMemoryAllowed = 8192; // Free 플랜 실제 값 (8GB)
    
    // 계정 정보에서 실제 제한값이 있으면 우선 사용
    if (accountInfo.limits?.maxCombinedActorMemoryMbytes) {
      maxMemoryAllowed = accountInfo.limits.maxCombinedActorMemoryMbytes;
    } else {
      // 플랜별 기본값 (실제 관찰된 값 기준)
      const plan = accountInfo.plan?.toString().toLowerCase();
      if (plan === 'free') {
        maxMemoryAllowed = 8192; // 8GB (실제 확인된 값)
      } else if (plan === 'starter') {
        maxMemoryAllowed = 32768; // 32GB
      } else if (plan === 'scale' || plan === 'business') {
        maxMemoryAllowed = 131072; // 128GB
      }
    }

    return {
      currentMemoryUsage,
      maxMemoryAllowed,
      usagePercentage: (currentMemoryUsage / maxMemoryAllowed) * 100,
      runningActorsCount: runningActors.length,
      runningActors,
      accountInfo,
    };
  }

  async getUsageStats(days = 7): Promise<ApifyUsageStats> {
    const runs = await this.getRecentRuns(1000);
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // 일별 통계
    const dailyStats = new Map<string, { computeUnits: number; memoryUsage: number; actorRuns: number }>();
    
    // 시간별 통계 (최근 24시간)
    const hourlyStats = new Map<string, { computeUnits: number; memoryUsage: number; actorRuns: number }>();

    runs.forEach(run => {
      if (!run.startedAt) return;
      
      const runDate = new Date(run.startedAt);
      if (runDate < startDate) return;

      // 일별 통계
      const dayKey = runDate.toISOString().split('T')[0];
      const dayStats = dailyStats.get(dayKey) || { computeUnits: 0, memoryUsage: 0, actorRuns: 0 };
      dayStats.computeUnits += run.stats?.computeUnits || 0;
      dayStats.memoryUsage += run.options?.memoryMbytes || 0;
      dayStats.actorRuns += 1;
      dailyStats.set(dayKey, dayStats);

      // 시간별 통계 (최근 24시간만)
      const hoursAgo = (now.getTime() - runDate.getTime()) / (1000 * 60 * 60);
      if (hoursAgo <= 24) {
        const hourKey = runDate.toISOString().split(':')[0] + ':00';
        const hourStats = hourlyStats.get(hourKey) || { computeUnits: 0, memoryUsage: 0, actorRuns: 0 };
        hourStats.computeUnits += run.stats?.computeUnits || 0;
        hourStats.memoryUsage += run.options?.memoryMbytes || 0;
        hourStats.actorRuns += 1;
        hourlyStats.set(hourKey, hourStats);
      }
    });

    // 총 컴퓨트 유닛 계산
    const totalComputeUnits = runs
      .filter(run => run.startedAt && new Date(run.startedAt) >= startDate)
      .reduce((sum, run) => sum + (run.stats?.computeUnits || 0), 0);

    return {
      totalComputeUnits,
      daily: Array.from(dailyStats.entries()).map(([date, stats]) => ({
        date,
        ...stats,
        totalCostUSD: 0,
        totalCostKRW: 0,
        actorDetails: [] as DailyActorDetail[],
      })).sort((a, b) => a.date.localeCompare(b.date)),
      hourly: Array.from(hourlyStats.entries()).map(([hour, stats]) => ({
        hour,
        ...stats,
      })).sort((a, b) => a.hour.localeCompare(b.hour)),
    };
  }

  // 상세 일별 통계 계산 (비용 및 액터별 세부사항 포함)
  async getDetailedUsageStats(days = 7): Promise<ApifyUsageStats> {
    const runs = await this.getRecentRuns(1000);
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // 일별 통계
    const dailyStats = new Map<string, any>();
    
    // 시간별 통계 (최근 24시간)
    const hourlyStats = new Map<string, { computeUnits: number; memoryUsage: number; actorRuns: number }>();

    runs.forEach(run => {
      if (!run.startedAt) return;
      
      const runDate = new Date(run.startedAt);
      if (runDate < startDate) return;

      // 일별 통계
      const dayKey = runDate.toISOString().split('T')[0];
      
      if (!dailyStats.has(dayKey)) {
        dailyStats.set(dayKey, {
          computeUnits: 0,
          memoryUsage: 0,
          actorRuns: 0,
          totalCostUSD: 0,
          totalCostKRW: 0,
          actorDetails: new Map<string, DailyActorDetail>(),
        });
      }

      const dayStats = dailyStats.get(dayKey);
      const runCost = this.calculateRunCost(run);
      const actorId = run.actId;
      const actorName = this.getActorDisplayName(run.actId);

      // 일별 총합 업데이트
      dayStats.computeUnits += run.stats?.computeUnits || 0;
      dayStats.memoryUsage += run.options?.memoryMbytes || 0;
      dayStats.actorRuns += 1;
      dayStats.totalCostUSD += runCost.totalCostUSD;
      dayStats.totalCostKRW += runCost.totalCostKRW;

      // 액터별 세부 통계
      if (!dayStats.actorDetails.has(actorId)) {
        dayStats.actorDetails.set(actorId, {
          actorId,
          actorName,
          runCount: 0,
          totalComputeUnits: 0,
          totalCostUSD: 0,
          totalCostKRW: 0,
          runs: [],
        });
      }

      const actorDetail = dayStats.actorDetails.get(actorId);
      actorDetail.runCount += 1;
      actorDetail.totalComputeUnits += run.stats?.computeUnits || 0;
      actorDetail.totalCostUSD += runCost.totalCostUSD;
      actorDetail.totalCostKRW += runCost.totalCostKRW;
      actorDetail.runs.push(run);

      // 시간별 통계 (최근 24시간만)
      const hoursAgo = (now.getTime() - runDate.getTime()) / (1000 * 60 * 60);
      if (hoursAgo <= 24) {
        const hourKey = runDate.toISOString().split(':')[0] + ':00';
        const hourStats = hourlyStats.get(hourKey) || { computeUnits: 0, memoryUsage: 0, actorRuns: 0 };
        hourStats.computeUnits += run.stats?.computeUnits || 0;
        hourStats.memoryUsage += run.options?.memoryMbytes || 0;
        hourStats.actorRuns += 1;
        hourlyStats.set(hourKey, hourStats);
      }
    });

    // 총 컴퓨트 유닛 계산
    const totalComputeUnits = runs
      .filter(run => run.startedAt && new Date(run.startedAt) >= startDate)
      .reduce((sum, run) => sum + (run.stats?.computeUnits || 0), 0);

    return {
      totalComputeUnits,
      daily: Array.from(dailyStats.entries()).map(([date, stats]) => ({
        date,
        computeUnits: stats.computeUnits,
        memoryUsage: stats.memoryUsage,
        actorRuns: stats.actorRuns,
        totalCostUSD: stats.totalCostUSD,
        totalCostKRW: stats.totalCostKRW,
        actorDetails: Array.from(stats.actorDetails.values()) as DailyActorDetail[],
      })).sort((a, b) => a.date.localeCompare(b.date)),
      hourly: Array.from(hourlyStats.entries()).map(([hour, stats]) => ({
        hour,
        ...stats,
      })).sort((a, b) => a.hour.localeCompare(b.hour)),
    };
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'RUNNING': return '#10B981'; // green
      case 'SUCCEEDED': return '#06B6D4'; // cyan
      case 'FAILED': return '#EF4444'; // red
      case 'TIMED-OUT': return '#F59E0B'; // amber
      case 'ABORTED': return '#6B7280'; // gray
      default: return '#8B5CF6'; // purple
    }
  }

  formatMemory(bytes: number): string {
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)}GB`;
    }
    return `${bytes}MB`;
  }

  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

export default ApifyMonitor;
