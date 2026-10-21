/**
 * Guards the download wiring, which typechecking cannot see.
 *
 * The details screen converts a title straight to its final file with
 * FFmpegKit; the downloads screen lists what is in the file-system index. Both
 * sides typecheck perfectly while never meeting, and the save then appears
 * nowhere — which is the failure this asserts against. These read the sources
 * rather than rendering, so the guard needs no React renderer.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../../src');

function read(rel: string): string {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

describe('download wiring', () => {
  const details = () => read('screens/details/DetailsScreenNew.tsx');
  const downloads = () => read('screens/downloads/DownloadsScreen.tsx');
  const storage = () => read('utils/downloadStorage.ts');

  it('DetailsScreen records finished saves in the file-system index', () => {
    const source = details();
    // Without this the file exists on disk but no screen can list it.
    expect(source).toContain('recordCompletedDownload');
    // Both paths must record: the movie save and the per-episode save.
    expect(source.match(/recordCompletedDownload\(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('DownloadsScreen lists the index, which is what DetailsScreen writes', () => {
    expect(downloads()).toContain('downloadManager.getCompletedDownloads');
    expect(storage()).toContain('export const recordCompletedDownload');
  });

  it('a recorded save is a completed entry the cards can render', () => {
    const source = storage();
    const start = source.indexOf('export const recordCompletedDownload');
    const body = source.slice(start, source.indexOf('export const getDownloadStorageUsage'));
    expect(body).toContain('DOWNLOAD_STATUS.COMPLETED');
    // filePath and fileSize are what the card and the play path read.
    expect(body).toContain('filePath');
    expect(body).toContain('fileSize');
  });

  it('deleting a recorded save removes the file it points at', () => {
    const source = storage();
    const start = source.indexOf('export const deleteDownloadFiles');
    const body = source.slice(start, source.indexOf('export const deleteDownload ='));
    // The recorded path is a single file, not the legacy per-title directory.
    expect(body).toContain('entry.filePath');
  });
});
