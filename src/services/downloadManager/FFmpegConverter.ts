// src/services/downloadManager/FFmpegConverter.ts
import { FFmpegKit, FFmpegKitConfig, ReturnCode, Level } from 'palash-ffmpeg-kit-react-native-sf';
import { AppState } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { buildProviderRequestHeaders } from '../../utils/streamHeaders';

// ─── MODULE-LEVEL INITIALIZATION ───
let isFFmpegInitialized = false;
let ffmpegInitError: Error | null = null;
let ffmpegFullyFunctional = false;

async function initializeFFmpeg(): Promise<boolean> {
  if (isFFmpegInitialized) return ffmpegFullyFunctional;
  if (ffmpegInitError) return false;

  try {
    console.log('[FFmpegConverter] Module-level initialization...');
    
    if (!FFmpegKit || !FFmpegKitConfig) {
      console.warn('[FFmpegConverter] FFmpegKit modules not available');
      ffmpegInitError = new Error('FFmpegKit modules not available');
      return false;
    }

    try {
      await FFmpegKitConfig.init();
      console.log('[FFmpegConverter] FFmpegKitConfig.init() completed');
      ffmpegFullyFunctional = true;
    } catch (initError: any) {
      console.warn('[FFmpegConverter] FFmpegKitConfig.init() failed:', initError);
    }

    try {
      if (FFmpegKitConfig && typeof FFmpegKitConfig.setLogLevel === 'function') {
        const logLevel = Level?.AV_LOG_QUIET;
        if (logLevel !== undefined) {
          FFmpegKitConfig.setLogLevel(logLevel);
        }
      }
    } catch (logError: any) {
      console.log('[FFmpegConverter] Log level setting skipped');
    }
    
    isFFmpegInitialized = true;
    console.log('[FFmpegConverter] Module-level initialization complete');
    return ffmpegFullyFunctional;
  } catch (error: any) {
    console.warn('[FFmpegConverter] Module-level initialization failed:', error);
    ffmpegInitError = error instanceof Error ? error : new Error(String(error));
    isFFmpegInitialized = true;
    return false;
  }
}

setTimeout(() => {
  initializeFFmpeg().catch(() => {});
}, 0);

// ─── FFMPEG CONVERTER CLASS ───
class FFmpegConverter {
  private isConverting: boolean = false;
  private currentSessionId: number | null = null;
  private appState: string = 'active';
  private appStateSubscription: any = null;
  private onProgressCallback: ((data: any) => void) | null = null;
  private wasCancelledDueToBackground: boolean = false;
  private conversionQueue: Array<{
    segmentsDir: string;
    outputPath: string;
    onProgress: ((data: any) => void) | undefined;
    headers: Record<string, string> | null;
    referer: string | null;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessingQueue: boolean = false;
  private isInitialized: boolean = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      await initializeFFmpeg();
      
      try {
        this.appState = AppState.currentState || 'active';
      } catch {
        this.appState = 'active';
      }
      
      if (AppState && typeof AppState.addEventListener === 'function') {
        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
      }
      
      this.isInitialized = true;
      console.log('[FFmpegConverter] Class initialized');
    } catch (error: any) {
      console.warn('[FFmpegConverter] Class initialization failed:', error);
      this.isInitialized = true;
    }
  }

  destroy() {
    if (this.appStateSubscription) {
      try {
        this.appStateSubscription.remove();
      } catch (error: any) {}
      this.appStateSubscription = null;
    }
    this.cancelConversion();
    this.conversionQueue = [];
    this.isInitialized = false;
  }

  handleAppStateChange = (nextAppState: string) => {
    if (this.appState === 'active' && nextAppState.match(/inactive|background/)) {
      if (this.isConverting) {
        this.wasCancelledDueToBackground = true;
        this.cancelConversion();
      }
    }
    this.appState = nextAppState;
  };

  async convertHLSToMP4(
    segmentsDir: string,
    outputPath: string,
    onProgress?: (data: any) => void,
    options?: { headers?: Record<string, string> | null; referer?: string | null }
  ) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return new Promise((resolve, reject) => {
      this.conversionQueue.push({
        segmentsDir,
        outputPath,
        onProgress: onProgress || undefined,
        headers: options?.headers ?? null,
        referer: options?.referer ?? null,
        resolve,
        reject
      });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.conversionQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.conversionQueue.length > 0) {
      const job = this.conversionQueue.shift();
      if (!job) continue;
      try {
        const result = await this.executeConversion(job.segmentsDir, job.outputPath, job.onProgress, {
          headers: job.headers,
          referer: job.referer,
        });
        job.resolve(result);
      } catch (error: any) {
        job.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.isProcessingQueue = false;
  }

  async executeConversion(
    segmentsDir: string,
    outputPath: string,
    onProgress?: (data: any) => void,
    options?: { headers?: Record<string, string> | null; referer?: string | null }
  ) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    this.isConverting = true;
    this.wasCancelledDueToBackground = false;
    this.onProgressCallback = onProgress || null;

    try {
      const segmentsDirClean = segmentsDir.replace('file://', '');
      const outputPathClean = outputPath.replace('file://', '');

      const segmentFiles = await this.getSegmentFiles(segmentsDirClean);
      if (segmentFiles.length === 0) {
        throw new Error('No segment files found');
      }

      const hasInit = await this.hasInitSegment(segmentsDirClean);
      const isFragmentedMp4 = segmentFiles[0]?.endsWith('.m4s') || hasInit;

      // The playlist is the only thing ffmpeg reads: the segments are already
      // on disk. Headers still have to be supplied for the init segment when
      // the playlist references it over the network, so the provider's set is
      // carried through here too.
      const requestHeaders = buildProviderRequestHeaders(
        options?.headers,
        undefined,
        options?.referer
      );
      const headerArgs: string[] = [];
      for (const [key, value] of Object.entries(requestHeaders)) {
        if (key.toLowerCase() === 'accept-encoding') continue;
        headerArgs.push('-headers', `${key}: ${value}\r\n`);
      }

      const playlistPath = `${segmentsDirClean}ffmpeg_playlist.m3u8`;
      let playlistContent = '#EXTM3U\n';
      playlistContent += '#EXT-X-VERSION:3\n';
      playlistContent += '#EXT-X-TARGETDURATION:10\n';
      playlistContent += '#EXT-X-MEDIA-SEQUENCE:0\n';
      playlistContent += '#EXT-X-PLAYLIST-TYPE:VOD\n';

      if (isFragmentedMp4 && hasInit) {
        playlistContent += `#EXT-X-MAP:URI="${segmentsDirClean}init.mp4"\n`;
      }

      const segmentNumbers = segmentFiles.map(f => {
        const match = f.match(/segment_(\d+)/);
        return match ? parseInt(match[1]) : -1;
      }).filter(n => n >= 0);

      let lastSegmentNum = -1;
      for (let i = 0; i < segmentFiles.length; i++) {
        const currentNum = segmentNumbers[i] || i;
        if (lastSegmentNum >= 0 && currentNum !== lastSegmentNum + 1) {
          playlistContent += '#EXT-X-DISCONTINUITY\n';
        }
        playlistContent += '#EXTINF:4.5,\n';
        playlistContent += `${segmentsDirClean}${segmentFiles[i]}\n`;
        lastSegmentNum = currentNum;
      }

      playlistContent += '#EXT-X-ENDLIST\n';
      await LegacyFileSystem.writeAsStringAsync(playlistPath, playlistContent);

      // Built as an argument array and run via executeWithArguments: header
      // values contain spaces, commas and colons, and joining them into one
      // shell string made ffmpeg split them into separate (invalid) options.
      const commandArgs = [
        '-allowed_extensions', 'ALL',
        ...headerArgs,
        '-i', playlistPath,
        '-c', 'copy',
        '-movflags', '+faststart',
        '-y',
        outputPathClean
      ];

      if (onProgress) {
        try {
          FFmpegKitConfig.enableStatisticsCallback((statistics) => {
            if (this.onProgressCallback) {
              try {
                const time = statistics.getTime();
                this.onProgressCallback({ time, phase: 'converting' });
              } catch (statsError: any) {}
            }
          });
        } catch (callbackError: any) {
          console.log('[FFmpegConverter] Statistics callback not available');
        }
      }

      const session = await FFmpegKit.executeWithArguments(commandArgs);
      this.currentSessionId = session.getSessionId();
      const returnCode = await session.getReturnCode();

      try {
        await LegacyFileSystem.deleteAsync(playlistPath, { idempotent: true });
      } catch (cleanupError: any) {}

      if (ReturnCode.isSuccess(returnCode)) {
        const outputFileInfo = await LegacyFileSystem.getInfoAsync(outputPathClean);
        const fileSize = outputFileInfo.exists ? (outputFileInfo.size || 0) : 0;
        this.isConverting = false;
        this.currentSessionId = null;
        return { success: true, filePath: outputPath, fileSize };
      } else if (ReturnCode.isCancel(returnCode)) {
        this.isConverting = false;
        this.currentSessionId = null;
        return { success: false, cancelled: true, cancelledDueToBackground: this.wasCancelledDueToBackground };
      } else {
        const logs = await session.getAllLogsAsString();
        console.error(`[FFmpegConverter] Conversion failed:`, logs);
        this.isConverting = false;
        this.currentSessionId = null;
        throw new Error('FFmpeg conversion failed: ' + (logs || 'Unknown error'));
      }
    } catch (error: any) {
      this.isConverting = false;
      this.currentSessionId = null;
      throw error;
    }
  }

  async getSegmentFiles(segmentsDir: string): Promise<string[]> {
    try {
      const contents = await LegacyFileSystem.readDirectoryAsync(segmentsDir);
      return contents
        .filter(file => file.endsWith('.ts') || file.endsWith('.m4s'))
        .filter(file => file.startsWith('segment_'))
        .sort((a, b) => {
          const numA = parseInt(a.match(/segment_(\d+)/)?.[1] || '0');
          const numB = parseInt(b.match(/segment_(\d+)/)?.[1] || '0');
          return numA - numB;
        });
    } catch (error: any) {
      return [];
    }
  }

  async hasInitSegment(segmentsDir: string): Promise<boolean> {
    try {
      const contents = await LegacyFileSystem.readDirectoryAsync(segmentsDir);
      return contents.includes('init.mp4');
    } catch (error: any) {
      return false;
    }
  }

  async cancelConversion() {
    if (this.currentSessionId) {
      try {
        await FFmpegKit.cancel(this.currentSessionId);
      } catch (error: any) {}
    }
    this.isConverting = false;
    this.currentSessionId = null;
  }

  getIsConverting() {
    return this.isConverting;
  }
}

const ffmpegConverter = new FFmpegConverter();
export default ffmpegConverter;