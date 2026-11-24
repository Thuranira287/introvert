import { render, screen } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders its children as button text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('disables the button and shows a loading state when isLoading is true', () => {
    render(<Button isLoading>Save</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('respects an explicit disabled prop', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  describe('asChild', () => {
    // Regression coverage: asChild was declared in the props type but not
    // actually implemented for a while, which silently rendered a <button>
    // wrapping the child (e.g. a Next.js <Link>/<a>) — invalid nested
    // interactive HTML that breaks navigation semantics.
    it('renders the child element directly instead of wrapping it in a <button>', () => {
      render(
        <Button asChild>
          <a href="/dashboard">Go to dashboard</a>
        </Button>,
      );

      const link = screen.getByRole('link', { name: 'Go to dashboard' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/dashboard');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('merges Button styling classes onto the child element', () => {
      render(
        <Button asChild variant="primary">
          <a href="/x">Link</a>
        </Button>,
      );

      const link = screen.getByRole('link');
      expect(link.className).toContain('bg-indigo-600');
    });

    it('preserves the child element\'s own className alongside Button styles', () => {
      render(
        <Button asChild>
          <a href="/x" className="custom-class">
            Link
          </a>
        </Button>,
      );

      expect(screen.getByRole('link').className).toContain('custom-class');
    });
  });
});
