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

/**
 * Guards the Live TV wiring.
 *
 * A live channel is a direct URL, so it never passes through the backend
 * resolver that normally supplies per-source request headers. The screen must
 * therefore hand the playlist's headers to the player itself. Both sides
 * typecheck while dropping them, and the failure is invisible in a build: the
 * stream resolves and then 403s on the first segment for every channel that
 * requires a matching User-Agent.
 */
describe('Live TV wiring', () => {
  const screen = () => read('screens/livetv/LiveTvScreen.tsx');
  const player = () => read('screens/player/VideoPlayerScreen.tsx');
  const hook = () => read('hooks/useLicensedPlaybackSource.ts');
  const tabLayout = () => fs.readFileSync(
    path.resolve(__dirname, '../../app/(tabs)/_layout.tsx'),
    'utf8'
  );
  const route = () => fs.readFileSync(
    path.resolve(__dirname, '../../app/(tabs)/live.tsx'),
    'utf8'
  );

  it('exposes the Live TV route as a tab', () => {
    expect(route()).toContain('LiveTvScreen');
    expect(tabLayout()).toContain('name="live"');
    expect(tabLayout()).toContain("t('tabs.live')");
  });

  it('sends the channel URL and headers to the player', () => {
    const source = screen();
    expect(source).toContain('streamUrl: channel.url');
    // Without the headers, channels needing a matching User-Agent fail.
    expect(source).toContain('streamHeaders:');
    expect(source).toContain('isLive:');
  });

  it('marks a live channel so the player skips watch progress', () => {
    // A live channel has no resumable position; recording one would leave a
    // phantom entry in Continue Watching.
    expect(screen()).toContain("isLive: 'true'");
    expect(player()).toContain("isLive === 'true'");
  });

  it('the player reads the headers param the screen sends', () => {
    const source = player();
    expect(source).toContain('streamHeaders: streamHeadersParam');
    expect(source).toContain('directStreamHeaders');
  });

  it('the playback hook uses the caller headers for a direct stream', () => {
    const source = hook();
    // A direct stream has no resolved source, so activeSource?.headers is
    // undefined and the headers must come from the caller instead.
    expect(source).toContain('directStreamHeaders');
    expect(source).toContain('directStreamUrl ? directStreamHeaders');
  });

  it('returns to the Live TV tab when a live channel is closed', () => {
    expect(player()).toContain("r.replace('/(tabs)/live')");
  });
});
