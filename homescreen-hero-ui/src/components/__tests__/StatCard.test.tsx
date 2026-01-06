import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from '../StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    const stat = { label: 'Total Collections', value: '42' };
    render(<StatCard stat={stat} />);

    expect(screen.getByText('Total Collections')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders hint when provided', () => {
    const stat = {
      label: 'Active Rotations',
      value: '5',
      hint: 'Last rotated 2 hours ago'
    };
    render(<StatCard stat={stat} />);

    expect(screen.getByText('Active Rotations')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Last rotated 2 hours ago')).toBeInTheDocument();
  });

  it('does not render hint when not provided', () => {
    const stat = { label: 'Test', value: '123' };
    render(<StatCard stat={stat} />);

    const hint = screen.queryByText(/ago/);
    expect(hint).not.toBeInTheDocument();
  });

  it('does not render hint when null', () => {
    const stat = { label: 'Test', value: '123', hint: null };
    render(<StatCard stat={stat} />);

    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });
});
