import { buildProviderRequestHeaders } from '../streamHeaders';

// The provider's own header set is what the backend issues alongside a stream
// URL. Dropping it — which is what reducing it to `Referer` did — makes most
// providers answer 403, so the download never completes.
describe('buildProviderRequestHeaders', () => {
  it('passes the provider set through verbatim', () => {
    const provider = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      Referer: 'https://provider.example/watch',
      Origin: 'https://provider.example',
      Cookie: 'session=abc123',
    };

    const headers = buildProviderRequestHeaders(provider);

    expect(headers).toEqual(provider);
  });

  it('keeps User-Agent and Cookie, which the Referer-only path discarded', () => {
    const headers = buildProviderRequestHeaders({
      'User-Agent': 'ProviderApp/2.1',
      Referer: 'https://provider.example/',
      Cookie: 'token=xyz',
    });

    expect(headers['User-Agent']).toBe('ProviderApp/2.1');
    expect(headers['Cookie']).toBe('token=xyz');
  });

  it('never inherits a Range header from the provider set', () => {
    // Range belongs to the individual segment request. Inheriting the
    // playlist's Range would truncate every segment to the same byte window.
    const headers = buildProviderRequestHeaders({
      'User-Agent': 'ProviderApp/2.1',
      Range: 'bytes=0-1023',
    });

    expect(headers.Range).toBeUndefined();
    expect(headers['User-Agent']).toBe('ProviderApp/2.1');
  });

  it('drops null and undefined values rather than sending "undefined"', () => {
    const headers = buildProviderRequestHeaders({
      'User-Agent': 'ProviderApp/2.1',
      Cookie: null as unknown as string,
      Origin: undefined as unknown as string,
    });

    expect(headers).toEqual({ 'User-Agent': 'ProviderApp/2.1' });
  });

  it('falls back to a browser fingerprint when the provider sent none', () => {
    const headers = buildProviderRequestHeaders(
      null,
      'https://cdn.example/movie.mp4',
      'https://cdn.example/'
    );

    expect(headers['User-Agent']).toBeTruthy();
    expect(headers['Referer']).toBe('https://cdn.example/');
  });

  it('treats an empty provider set as "none supplied"', () => {
    const headers = buildProviderRequestHeaders({}, 'https://cdn.example/movie.mp4');

    expect(headers['User-Agent']).toBeTruthy();
  });

  it('returns an empty set when there is neither a provider set nor a URL', () => {
    expect(buildProviderRequestHeaders(null)).toEqual({});
  });
});
