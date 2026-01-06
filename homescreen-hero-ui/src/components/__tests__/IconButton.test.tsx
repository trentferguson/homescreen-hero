import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IconButton from '../IconButton';

describe('IconButton', () => {
  it('renders children content', () => {
    render(
      <IconButton label="Test Button">
        <span>Icon</span>
      </IconButton>
    );

    expect(screen.getByText('Icon')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(
      <IconButton label="Close Dialog">
        <span>X</span>
      </IconButton>
    );

    const button = screen.getByLabelText('Close Dialog');
    expect(button).toBeInTheDocument();
  });

  it('has correct title attribute', () => {
    render(
      <IconButton label="Delete Item">
        <span>🗑️</span>
      </IconButton>
    );

    const button = screen.getByTitle('Delete Item');
    expect(button).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <IconButton label="Click me" onClick={handleClick}>
        <span>Click</span>
      </IconButton>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('works without onClick handler', async () => {
    const user = userEvent.setup();

    render(
      <IconButton label="No handler">
        <span>Click</span>
      </IconButton>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    // Should not throw error
    expect(button).toBeInTheDocument();
  });

  it('is keyboard accessible', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <IconButton label="Keyboard test" onClick={handleClick}>
        <span>Press me</span>
      </IconButton>
    );

    const button = screen.getByRole('button');
    button.focus();
    await user.keyboard('{Enter}');

    expect(handleClick).toHaveBeenCalled();
  });
});
