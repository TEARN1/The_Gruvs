import React from 'react';
import { render } from '@testing-library/react-native';

// Avoid pulling in expo-av through AutoPlayVideo.
jest.mock('../src/components/AutoPlayVideo', () => ({ AutoPlayVideo: () => null }));

import { MediaViewer } from '../src/components/MediaViewer';

describe('MediaViewer', () => {
  it('shows the empty state when there is no media', () => {
    const { getByText } = render(<MediaViewer media={[]} />);
    expect(getByText('No photo added')).toBeTruthy();
  });

  it('renders a position counter for a multi-image carousel', () => {
    const media = [
      { url: 'https://x/1.jpg', type: 'image' },
      { url: 'https://x/2.jpg', type: 'image' },
      { url: 'https://x/3.jpg', type: 'image' },
    ];
    const { getByText } = render(<MediaViewer media={media} />);
    // Counter badge shows "<active+1>/<total>" — proves >1 image swipe UI is present
    expect(getByText('1/3')).toBeTruthy();
  });

  it('does not show a counter for a single image', () => {
    const { queryByText } = render(<MediaViewer media={[{ url: 'https://x/1.jpg', type: 'image' }]} />);
    expect(queryByText('1/1')).toBeNull();
  });
});
