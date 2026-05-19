import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { PasswordInput } from '../password-input';

const labels = { show: 'Show password', hide: 'Hide password' };

describe('PasswordInput', () => {
  afterEach(() => cleanup());

  it('renders as type=password by default with the show label and aria-pressed false', () => {
    render(<PasswordInput id="p" toggleLabels={labels} />);
    const input = document.querySelector('input') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles to type=text and switches aria-pressed + label on click', () => {
    render(<PasswordInput id="p" toggleLabels={labels} />);
    const toggle = screen.getByRole('button', { name: 'Show password' });
    fireEvent.click(toggle);

    expect(document.querySelector('input[type="text"]')).not.toBeNull();
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('aria-label', 'Hide password');
  });

  it('forwards value and onChange like a normal input', () => {
    const onChange = vi.fn();
    render(
      <PasswordInput
        id="p"
        toggleLabels={labels}
        value="abc"
        onChange={onChange}
      />,
    );
    const input = document.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('abc');
    fireEvent.change(input, { target: { value: 'abcd' } });
    expect(onChange).toHaveBeenCalled();
  });
});
