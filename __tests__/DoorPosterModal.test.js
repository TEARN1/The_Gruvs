import React from 'react';
import { render } from '@testing-library/react-native';

// The QR renderer pulls in native SVG; the value it's handed is what matters here.
jest.mock('react-native-qrcode-svg', () => ({
  __esModule: true,
  default: ({ value }) => {
    const { Text } = require('react-native');
    return <Text testID="qr">{value}</Text>;
  },
}));

import { DoorPosterModal } from '../src/components/DoorPosterModal';

const event = { id: '8f3c1a9e-1111-2222-3333-444455556666', title: 'Amapiano Sunset', venue_name: 'Konka', city: 'Soweto' };

describe('DoorPosterModal — the sign that goes on the venue door', () => {
  it('encodes a QR that opens THIS event and carries the host code', () => {
    const { getByTestId } = render(
      <DoorPosterModal visible onClose={() => {}} event={event} hostRefCode="HOST123" />,
    );
    const encoded = getByTestId('qr').props.children;
    expect(encoded).toContain('/e/amapiano-sunset-soweto-8f3c1a9e');
    expect(encoded).toContain('ref=HOST123');
    expect(encoded).toContain('src=door');
  });

  it('shows the event and the door call to action', () => {
    const { getByText } = render(
      <DoorPosterModal visible onClose={() => {}} event={event} hostRefCode="HOST123" />,
    );
    expect(getByText('Amapiano Sunset')).toBeTruthy();
    expect(getByText('Konka')).toBeTruthy();
    expect(getByText('Scan to Touch Down')).toBeTruthy();
  });

  it('still renders a usable sign for a host with no referral code', () => {
    const { getByTestId } = render(
      <DoorPosterModal visible onClose={() => {}} event={event} hostRefCode={undefined} />,
    );
    expect(getByTestId('qr').props.children).toContain('src=door');
  });

  it('renders nothing without an event rather than throwing', () => {
    const { toJSON } = render(<DoorPosterModal visible onClose={() => {}} event={null} />);
    expect(toJSON()).toBeNull();
  });
});
