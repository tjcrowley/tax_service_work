import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import OfflineBanner from './OfflineBanner';

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('OfflineBanner', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('tax-crm-offline');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
    setOnline(true);
  });

  afterEach(() => {
    cleanup();
    setOnline(true);
  });

  it('does not render when online', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders when an offline event fires and disappears when online event fires', async () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('alert')).toBeNull();

    await act(async () => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(/offline/i);

    await act(async () => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
