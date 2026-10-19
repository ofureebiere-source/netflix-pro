import {
  getDownloadsIndex,
  saveDownloadEntry,
  updateDownloadEntry,
  removeDownloadEntry,
  createDownloadEntry,
  DOWNLOAD_STATUS,
} from '../../utils/downloadStorage';

class DownloadQueue {
  items: any;
  listeners: any;
  initialized: any;
  constructor() {
    this.items = [];
    this.listeners = new Set();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    await this.restore();
    this.initialized = true;
  }

  async restore() {
    try {
      const index = await getDownloadsIndex();
      this.items = Object.values(index.downloads).filter(
        (item: any) =>
          item.status === DOWNLOAD_STATUS.QUEUED ||
          item.status === DOWNLOAD_STATUS.DOWNLOADING ||
          item.status === DOWNLOAD_STATUS.PAUSED
      );
      this.items.sort((a: any, b: any) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());
      this.notifyListeners();
    } catch (error: any) {
      this.items = [];
    }
  }

  async enqueue(mediaInfo: any) {
    const existingItem = this.items.find((item: any) => item.id === mediaInfo.id);
    if (existingItem) {
      if (existingItem.status === DOWNLOAD_STATUS.FAILED) {
        await this.remove(existingItem.id);
      } else {
        throw new Error('Item already in queue');
      }
    }

    const entry = typeof mediaInfo.id === 'string' && mediaInfo.status
      ? mediaInfo
      : createDownloadEntry(mediaInfo);

    entry.status = DOWNLOAD_STATUS.QUEUED;
    entry.queuedAt = new Date().toISOString();
    entry.retryCount = 0;
    entry.errorMessage = null;

    await saveDownloadEntry(entry);
    this.items.push(entry);
    this.notifyListeners();

    return entry;
  }

  async enqueueBatch(mediaInfoArray: any) {
    const entries = [];
    for (const mediaInfo of mediaInfoArray) {
      try {
        const entry = await this.enqueue(mediaInfo);
        entries.push(entry);
      } catch (error: any) {
        // Skip items that fail to enqueue
      }
    }
    return entries;
  }

  getNext() {
    return this.items.find((item: any) => item.status === DOWNLOAD_STATUS.QUEUED) || null;
  }

  getAll() {
    return [...this.items];
  }

  getById(id: any) {
    return this.items.find((item: any) => item.id === id) || null;
  }

  getQueuedItems() {
    return this.items.filter((item: any) => item.status === DOWNLOAD_STATUS.QUEUED);
  }

  getDownloadingItems() {
    return this.items.filter((item: any) => item.status === DOWNLOAD_STATUS.DOWNLOADING);
  }

  getPausedItems() {
    return this.items.filter((item: any) => item.status === DOWNLOAD_STATUS.PAUSED);
  }

  async updateStatus(id: any, status: any, additionalData = {}) {
    try {
      const item = this.items.find((i: any) => i.id === id);
      if (item) {
        item.status = status;
        Object.assign(item, additionalData);

        if (status === DOWNLOAD_STATUS.DOWNLOADING && !item.startedAt) {
          item.startedAt = new Date().toISOString();
        }
        if (status === DOWNLOAD_STATUS.COMPLETED) {
          item.completedAt = new Date().toISOString();
          item.progress = 100;
        }

        await updateDownloadEntry(id, { status, ...additionalData });
        this.notifyListeners();
        return true;
      }
      return false;
    } catch (error: any) {
      return false;
    }
  }

  async updateProgress(id: any, progress: any, downloadedBytes = 0, totalBytes = 0) {
    try {
      const item = this.items.find((i: any) => i.id === id);
      if (item) {
        item.progress = progress;
        item.downloadedBytes = downloadedBytes;
        item.totalBytes = totalBytes;

        await updateDownloadEntry(id, { progress, downloadedBytes, totalBytes });
        this.notifyListeners();
        return true;
      }
      return false;
    } catch (error: any) {
      return false;
    }
  }

  async markCompleted(id: any, fileSize = 0, filePath = null) {
    try {
      const updates: { status: string; completedAt: string; progress: number; fileSize: any; filePath?: string } = {
        status: DOWNLOAD_STATUS.COMPLETED,
        completedAt: new Date().toISOString(),
        progress: 100,
        fileSize,
      };
      if (filePath) {
        updates.filePath = filePath;
      }

      const item = this.items.find((i: any) => i.id === id);
      if (item) {
        Object.assign(item, updates);
        await updateDownloadEntry(id, updates);
        this.items = this.items.filter((i: any) => i.id !== id);
        this.notifyListeners();
        return true;
      }
      return false;
    } catch (error: any) {
      return false;
    }
  }

  async markFailed(id: any, errorMessage = 'Unknown error') {
    try {
      const item = this.items.find((i: any) => i.id === id);
      if (item) {
        item.status = DOWNLOAD_STATUS.FAILED;
        item.errorMessage = errorMessage;
        item.retryCount = (item.retryCount || 0) + 1;

        await updateDownloadEntry(id, {
          status: DOWNLOAD_STATUS.FAILED,
          errorMessage,
          retryCount: item.retryCount,
        });

        this.items = this.items.filter((i: any) => i.id !== id);
        this.notifyListeners();
        return true;
      }
      return false;
    } catch (error: any) {
      return false;
    }
  }

  async pause(id: any) {
    return this.updateStatus(id, DOWNLOAD_STATUS.PAUSED);
  }

  async resume(id: any) {
    return this.updateStatus(id, DOWNLOAD_STATUS.QUEUED);
  }

  async remove(id: any) {
    try {
      await removeDownloadEntry(id);
      this.items = this.items.filter((item: any) => item.id !== id);
      this.notifyListeners();
      return true;
    } catch (error: any) {
      return false;
    }
  }

  async clear() {
    try {
      for (const item of this.items) {
        await removeDownloadEntry(item.id);
      }
      this.items = [];
      this.notifyListeners();
      return true;
    } catch (error: any) {
      return false;
    }
  }

  getQueueLength() {
    return this.items.length;
  }

  getQueuedCount() {
    return this.getQueuedItems().length;
  }

  isInQueue(id: any) {
    return this.items.some((item: any) => item.id === id);
  }

  subscribe(callback: any) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners() {
    const items = this.getAll();
    this.listeners.forEach((callback: any) => {
      try {
        callback(items);
      } catch (error: any) {
        // Listener error, ignore
      }
    });
  }
}

const downloadQueue = new DownloadQueue();
export default downloadQueue;
