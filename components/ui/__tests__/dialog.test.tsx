import React from 'react';
import { render, screen } from '@testing-library/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';

describe('DialogContent', () => {
  it('provides a scrollable shell for tall content', () => {
    render(
      <Dialog open onOpenChange={() => undefined}>
        <DialogContent aria-label="Scrollable dialog">
          <DialogHeader>
            <DialogTitle>Scrollable dialog</DialogTitle>
          </DialogHeader>
          <div style={{ height: 1200 }}>Tall content</div>
        </DialogContent>
      </Dialog>
    );

    const dialog = screen.getByRole('dialog', { name: /scrollable dialog/i });
    expect(dialog).toHaveClass('overflow-y-auto');
    expect(dialog).toHaveClass('max-h-[calc(100dvh-1rem)]');
    expect(dialog).not.toHaveClass('max-sm:h-dvh');
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('opts into an edge-to-edge scrollable shell on phones without changing the desktop layout', () => {
    render(
      <Dialog open>
        <DialogContent mobileLayout="fullscreen" className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Record task</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByRole('dialog', { name: 'Record task' })).toHaveClass(
      'max-sm:inset-0',
      'max-sm:h-dvh',
      'max-sm:border-0',
      'max-sm:px-4',
      'max-sm:shadow-none',
      'overflow-y-auto',
      'sm:max-w-xl'
    );
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('max-sm:size-11');
  });

  it('allows callers to override the default scroll behavior', () => {
    render(
      <Dialog open onOpenChange={() => undefined}>
        <DialogContent aria-label="Custom dialog" className="overflow-hidden max-h-96">
          <DialogHeader>
            <DialogTitle>Custom dialog</DialogTitle>
          </DialogHeader>
          <div>Body</div>
        </DialogContent>
      </Dialog>
    );

    const dialog = screen.getByRole('dialog', { name: /custom dialog/i });
    expect(dialog).toHaveClass('overflow-hidden');
    expect(dialog).toHaveClass('max-h-96');
    expect(dialog).not.toHaveClass('overflow-y-auto');
  });
});
