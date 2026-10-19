import * as LegacyFileSystem from 'expo-file-system/legacy';
import {
  ensureDirectoryExists,
  initializeDownloadsDirectory,
} from '../../utils/downloadStorage';
import {
  getDownloadsDirectory,
  getContentDirectory,
} from '../../utils/storage';

class StorageManager {
  initialized: any;
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    await initializeDownloadsDirectory();
    this.initialized = true;
  }

  async downloadFile(url: any, destPath: any, options: { headers?: Record<string, string>; onProgress?: (p: any) => void } = {}) {
    const { headers = {}, onProgress } = options;

    try {
      const dirPath = destPath.substring(0, destPath.lastIndexOf('/'));
      await ensureDirectoryExists(dirPath);

      const downloadResumable = LegacyFileSystem.createDownloadResumable(
        url,
        destPath,
        { headers },
        (downloadProgress) => {
          if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
            const progress = (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100;
            onProgress({
              progress,
              bytesWritten: downloadProgress.totalBytesWritten,
              totalBytes: downloadProgress.totalBytesExpectedToWrite,
            });
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      return {
        success: true,
        uri: result?.uri,
        status: result?.status,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async downloadFileSimple(url: any, destPath: any, headers = {}) {
    try {
      const dirPath = destPath.substring(0, destPath.lastIndexOf('/'));
      await ensureDirectoryExists(dirPath);

      const result = await LegacyFileSystem.downloadAsync(url, destPath, { headers });
      return {
        success: result.status >= 200 && result.status < 300,
        uri: result.uri,
        status: result.status,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async writeFile(filePath: any, content: any) {
    try {
      const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
      await ensureDirectoryExists(dirPath);
      await LegacyFileSystem.writeAsStringAsync(filePath, content);
      return true;
    } catch (error: any) {
      return false;
    }
  }

  async readFile(filePath: any) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(filePath);
      if (!info.exists) return null;
      return await LegacyFileSystem.readAsStringAsync(filePath);
    } catch (error: any) {
      return null;
    }
  }

  async deleteFile(filePath: any) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(filePath);
      if (info.exists) {
        await LegacyFileSystem.deleteAsync(filePath, { idempotent: true });
      }
      return true;
    } catch (error: any) {
      return false;
    }
  }

  async deleteDirectory(dirPath: any) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(dirPath);
      if (info.exists) {
        await LegacyFileSystem.deleteAsync(dirPath, { idempotent: true });
      }
      return true;
    } catch (error: any) {
      return false;
    }
  }

  async fileExists(filePath: any) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(filePath);
      return info.exists;
    } catch (error: any) {
      return false;
    }
  }

  async getFileInfo(filePath: any) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(filePath, { size: true } as any);
      if (!info.exists) return null;
      return {
        exists: info.exists,
        size: info.size || 0,
        uri: info.uri,
        isDirectory: false,
      };
    } catch (error: any) {
      return null;
    }
  }

  async getDirectoryContents(dirPath: any) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(dirPath);
      if (!info.exists) return [];
      return await LegacyFileSystem.readDirectoryAsync(dirPath);
    } catch (error: any) {
      return [];
    }
  }

  async getDirectorySize(dirPath: any) {
    try {
      let totalSize = 0;
      const contents = await this.getDirectoryContents(dirPath);

      for (const item of contents) {
        const itemPath = `${dirPath}/${item}`;
        try {
          const info = await LegacyFileSystem.getInfoAsync(itemPath, { size: true } as any);
          if (info.isDirectory) {
            totalSize += await this.getDirectorySize(itemPath);
          } else if (info.exists) {
            totalSize += info.size || 0;
          }
        } catch (e: any) {
          // Skip items that can't be read
        }
      }

      return totalSize;
    } catch (error: any) {
      return 0;
    }
  }

  async getAvailableStorage() {
    try {
      const freeSpace = await LegacyFileSystem.getFreeDiskStorageAsync();
      return freeSpace;
    } catch (error: any) {
      return 0;
    }
  }

  async getTotalStorage() {
    try {
      const totalSpace = await LegacyFileSystem.getTotalDiskCapacityAsync();
      return totalSpace;
    } catch (error: any) {
      return 0;
    }
  }

  async copyFile(sourcePath: any, destPath: any) {
    try {
      const dirPath = destPath.substring(0, destPath.lastIndexOf('/'));
      await ensureDirectoryExists(dirPath);
      await LegacyFileSystem.copyAsync({ from: sourcePath, to: destPath });
      return true;
    } catch (error: any) {
      return false;
    }
  }

  async moveFile(sourcePath: any, destPath: any) {
    try {
      const dirPath = destPath.substring(0, destPath.lastIndexOf('/'));
      await ensureDirectoryExists(dirPath);
      await LegacyFileSystem.moveAsync({ from: sourcePath, to: destPath });
      return true;
    } catch (error: any) {
      return false;
    }
  }

  getContentDirectory(mediaType: any, tmdbId: any, season = null, episode = null) {
    return getContentDirectory(mediaType, tmdbId, season, episode);
  }

  getDownloadsDirectory() {
    return getDownloadsDirectory();
  }
}

const storageManager = new StorageManager();
export default storageManager;