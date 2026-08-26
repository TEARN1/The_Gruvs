import { doorUrl, refFromUrl } from '../src/utils/doorCode';

const event = { id: '8f3c1a9e-1111-2222-3333-444455556666', title: 'Amapiano Sunset', city: 'Soweto' };

describe('doorCode — the printed door sign has to land people on THIS event', () => {
  it('points at the event itself, not a generic install page', () => {
    const url = doorUrl(event, 'HOST123');
    expect(url).toContain('/e/amapiano-sunset-soweto-8f3c1a9e');
    expect(url.startsWith('https://thegruvs.com/')).toBe(true);
  });

  it('carries the host referral code and marks the scan as a door scan', () => {
    const url = doorUrl(event, 'HOST123');
    expect(url).toContain('ref=HOST123');
    expect(url).toContain('src=door');
  });

  it('still produces a working link when the host has no referral code', () => {
    const url = doorUrl(event, null);
    expect(url).toContain('src=door');
    expect(url).not.toContain('ref=');
  });

  it('round-trips the referral code back out of the landing URL', () => {
    expect(refFromUrl(doorUrl(event, 'HOST123'))).toBe('HOST123');
  });

  it('attributes nobody for a plain visit or a junk ref', () => {
    expect(refFromUrl('https://thegruvs.com/e/x-8f3c1a9e')).toBeNull();
    expect(refFromUrl('https://thegruvs.com/?ref=')).toBeNull();
    expect(refFromUrl("https://thegruvs.com/?ref=<script>")).toBeNull();
    expect(refFromUrl('https://thegruvs.com/?ref=ab')).toBeNull(); // too short to be real
    expect(refFromUrl(null)).toBeNull();
  });
});
