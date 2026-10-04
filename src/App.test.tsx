import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App routing', () => {
  it('renders the 6006 homepage', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(screen.getByRole('link', { name: '6006 Performance home' })).toBeInTheDocument();
    expect(screen.getByText('PERFORMANCE')).toBeInTheDocument();
  });

  it('resolves a direct fault detail route', () => {
    render(<MemoryRouter initialEntries={['/fehlercodes/P0299']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'P0299' })).toBeInTheDocument();
  });
});
