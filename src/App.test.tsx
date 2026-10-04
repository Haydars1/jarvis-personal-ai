import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App routing', () => {
  it('renders the 6006 homepage', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: '6006 PERFORMANCE' })).toBeInTheDocument();
  });

  it('resolves a direct fault detail route', () => {
    render(<MemoryRouter initialEntries={['/fehlercodes/P0299']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Fehlercode P0299' })).toBeInTheDocument();
  });
});
