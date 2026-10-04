import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App routing', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('de-DE');
  });

  it('renders the 6006 homepage with support chat', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    const brand = screen.getByRole('link', { name: '6006 Performance home' });
    expect(brand).toBeInTheDocument();
    expect(within(brand).getByText('PERFORMANCE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /diagnose-chat/i })).toBeInTheDocument();
  });

  it('resolves a direct fault detail route with support chat', () => {
    render(<MemoryRouter initialEntries={['/fehlercodes/P0299']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'P0299' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /diagnose-chat/i })).toBeInTheDocument();
  });
});
