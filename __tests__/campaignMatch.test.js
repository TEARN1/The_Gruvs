import { campaignMatchesViewer } from '../src/utils/campaignMatch';

const T = {
  demographics: { age_min: '21', age_max: '35', gender: ['Female'] },
  geographic: { cities: ['Johannesburg'] },
  interests: { music_genres: ['Amapiano', 'House'] },
  behaviour: { event_categories: ['Nightlife'] },
};

describe('campaignMatchesViewer — targeting actually applies', () => {
  it('matches a viewer who fits every set dimension', () => {
    const viewer = { gender: 'female', city: 'Johannesburg', interests: ['Amapiano'], birth_year: new Date().getFullYear() - 28 };
    expect(campaignMatchesViewer(T, viewer, { category: 'Nightlife' })).toBe(true);
  });

  it('excludes a known city mismatch', () => {
    const viewer = { gender: 'Female', city: 'Cape Town', interests: ['House'], age: 28 };
    expect(campaignMatchesViewer(T, viewer, { category: 'Nightlife' })).toBe(false);
  });

  it('excludes a known gender / age / interest / category mismatch', () => {
    expect(campaignMatchesViewer(T, { gender: 'Male', city: 'Johannesburg', interests: ['Amapiano'], age: 28 }, { category: 'Nightlife' })).toBe(false);
    expect(campaignMatchesViewer(T, { gender: 'Female', city: 'Johannesburg', interests: ['Amapiano'], age: 50 }, { category: 'Nightlife' })).toBe(false);
    expect(campaignMatchesViewer(T, { gender: 'Female', city: 'Johannesburg', interests: ['Techno'], age: 28 }, { category: 'Nightlife' })).toBe(false);
    expect(campaignMatchesViewer(T, { gender: 'Female', city: 'Johannesburg', interests: ['Amapiano'], age: 28 }, { category: 'Sports' })).toBe(false);
  });

  it('passes dimensions the viewer has no data for (never excludes on missing data)', () => {
    expect(campaignMatchesViewer(T, { city: 'Johannesburg', age: 28 }, { category: 'Nightlife' })).toBe(true); // no gender/interests known
    expect(campaignMatchesViewer(T, {}, {})).toBe(true);
  });

  it('an untargeted campaign matches everyone', () => {
    expect(campaignMatchesViewer({}, { gender: 'Male', city: 'Durban' }, { category: 'Food' })).toBe(true);
    expect(campaignMatchesViewer({ behaviour: { event_phases: ['pre_event'] } }, {}, {})).toBe(true);
  });
});
