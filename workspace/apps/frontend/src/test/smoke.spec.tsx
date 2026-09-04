import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function SmokeComponent() {
  return <p>Frontend test harness ready</p>;
}

describe('frontend test harness', () => {
  it('renders a React component in jsdom', () => {
    render(<SmokeComponent />);

    expect(screen.getByText('Frontend test harness ready')).toBeInTheDocument();
  });
});
