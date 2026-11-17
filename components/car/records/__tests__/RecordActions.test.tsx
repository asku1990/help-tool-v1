import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecordActions from '../RecordActions';

afterEach(cleanup);

function renderActions() {
  const select = vi.fn();
  render(
    <RecordActions label="Record actions">
      <button type="button" onClick={select}>
        Edit
      </button>
      <button type="button">Delete</button>
    </RecordActions>
  );
  return { select, trigger: screen.getByRole('button', { name: 'Record actions' }) };
}

describe('Record actions', () => {
  it('toggles the action disclosure without selecting anything', () => {
    const { trigger, select } = renderActions();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(select).not.toHaveBeenCalled();
  });

  it('closes on selection and returns focus to the trigger', () => {
    const { trigger, select } = renderActions();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(select).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    const { trigger } = renderActions();
    fireEvent.click(trigger);
    screen.getByRole('button', { name: 'Delete' }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('closes on an outside pointer press without selecting an action', () => {
    const { trigger, select } = renderActions();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(select).not.toHaveBeenCalled();
  });
});
