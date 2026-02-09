// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PageListItem from '@/components/PageListItem';

const defaultProps = {
  dataTestId: 'page-item-1',
  title: 'Test Page',
  timestamp: 1700000000000,
  opacity: 1,
  onAction: vi.fn(),
  actionAriaLabel: 'アーカイブ',
  actionTitle: 'アーカイブ',
  actionClassName: 'archive-button',
  actionIcon: <span data-testid="action-icon">icon</span>,
};

beforeEach(() => {
  cleanup();
});

describe('PageListItem', () => {
  it('displays title in h3 and formatted date in p', () => {
    render(<PageListItem {...defaultProps} />);

    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).toBe('Test Page');

    const date = new Date(defaultProps.timestamp).toLocaleString();
    expect(screen.getByText(date)).toBeTruthy();
  });

  it('calls onNavigate on click', () => {
    const onNavigate = vi.fn();
    render(
      <PageListItem
        {...defaultProps}
        onNavigate={onNavigate}
        navigateAriaLabel="Test Pageを開く"
      />,
    );

    const navigateButton = screen.getByLabelText('Test Pageを開く');
    fireEvent.click(navigateButton);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('calls onNavigate on Enter/Space key', () => {
    const onNavigate = vi.fn();
    render(
      <PageListItem
        {...defaultProps}
        onNavigate={onNavigate}
        navigateAriaLabel="Test Pageを開く"
      />,
    );

    const navigateButton = screen.getByLabelText('Test Pageを開く');
    fireEvent.keyDown(navigateButton, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(navigateButton, { key: ' ' });
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });

  it('calls onAction when action button is clicked', () => {
    const onAction = vi.fn();
    render(<PageListItem {...defaultProps} onAction={onAction} />);

    const actionButton = screen.getByLabelText('アーカイブ');
    fireEvent.click(actionButton);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('action button click does not propagate to navigate', () => {
    const onNavigate = vi.fn();
    const onAction = vi.fn();
    render(
      <PageListItem
        {...defaultProps}
        onNavigate={onNavigate}
        navigateAriaLabel="Test Pageを開く"
        onAction={onAction}
      />,
    );

    const actionButton = screen.getByLabelText('アーカイブ');
    fireEvent.click(actionButton);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does not render button role when onNavigate is not provided', () => {
    render(<PageListItem {...defaultProps} />);

    // Only the action button should have role="button", no navigate div
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-label')).toBe('アーカイブ');
  });

  it('sets data-testid', () => {
    const { container } = render(<PageListItem {...defaultProps} />);

    const element = container.querySelector('[data-testid="page-item-1"]');
    expect(element).toBeTruthy();
  });

  it('reflects opacity in style', () => {
    const { container } = render(
      <PageListItem {...defaultProps} opacity={0.5} />,
    );

    const element = container.querySelector('[data-testid="page-item-1"]');
    expect((element as HTMLElement).style.opacity).toBe('0.5');
  });
});
