import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  cleanup,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';

const h = vi.hoisted(() => ({
  mountSpy: vi.fn(),
  flushSpy: vi.fn(),
  mockSave: vi.fn(),
  mockRefresh: vi.fn(),
  state: {
    onChange: null as ((p: unknown) => void) | null,
    initialHtml: null as string | null,
  },
}));

// Stub the shared editor: record mounts (useEffect [] = real mount,
// not re-render), capture onChange + handleRef, expose latest
// initialHtml so the test can assert fresh content after a doc swap.
vi.mock('@/shared/components/lexical-editor', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const LexicalEditor = (props: {
    initialHtml?: string | null;
    onChange: (p: unknown) => void;
    handleRef?: { current: unknown };
  }) => {
    h.state.onChange = props.onChange;
    h.state.initialHtml = props.initialHtml ?? null;
    if (props.handleRef) {
      props.handleRef.current = { flushOnChange: h.flushSpy };
    }
    React.useEffect(() => {
      h.mountSpy();
    }, []);
    return null;
  };
  return { LexicalEditor };
});

vi.mock('../../actions/save-legal-document', () => ({
  saveLegalDocument: (...a: unknown[]) => h.mockSave(...a),
}));

vi.mock('../legal-doc-translate-ai-button', () => ({
  LegalDocTranslateAiButton: () => null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: h.mockRefresh }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { LegalDocumentEditor } from '../legal-document-editor';
import type { LegalDocument } from '../../types';

function makeDoc(updatedAt: string, esHtml: string): LegalDocument {
  return {
    id: 'doc-1',
    slug: 'transparency',
    updated_at: updatedAt,
    translations: { es: { lexicalState: null, richHtml: esHtml } },
  };
}

beforeEach(() => {
  h.mountSpy.mockClear();
  h.flushSpy.mockClear();
  h.mockSave.mockReset();
  h.mockRefresh.mockClear();
  h.state.onChange = null;
  h.state.initialHtml = null;
});

afterEach(cleanup);

describe('LegalDocumentEditor — remount contract', () => {
  it('does NOT remount the editor when the user types (onChange)', async () => {
    render(<LegalDocumentEditor doc={makeDoc('t0', '<p>ES0</p>')} />);
    await waitFor(() => expect(h.mountSpy).toHaveBeenCalledTimes(1));

    await act(async () => {
      h.state.onChange?.({ state: { foo: 1 }, html: '<p>typed</p>' });
    });

    expect(h.mountSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT remount the editor on manual save', async () => {
    h.mockSave.mockResolvedValue({ data: { updated_at: 't1' } });
    const { getByText } = render(
      <LegalDocumentEditor doc={makeDoc('t0', '<p>ES0</p>')} />,
    );
    await waitFor(() => expect(h.mountSpy).toHaveBeenCalledTimes(1));

    await act(async () => {
      h.state.onChange?.({ state: { foo: 1 }, html: '<p>typed</p>' });
    });
    fireEvent.click(getByText('save'));
    await waitFor(() => expect(h.mockSave).toHaveBeenCalledTimes(1));

    expect(h.mountSpy).toHaveBeenCalledTimes(1);
  });

  it('remounts the editor on locale tab change (flushing first)', async () => {
    const { getByText } = render(
      <LegalDocumentEditor doc={makeDoc('t0', '<p>ES0</p>')} />,
    );
    await waitFor(() => expect(h.mountSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(getByText('EN'));

    await waitFor(() => expect(h.mountSpy).toHaveBeenCalledTimes(2));
    expect(h.flushSpy).toHaveBeenCalled();
  });

  it('remounts once with FRESH content when doc prop changes (AI translate)', async () => {
    const { rerender } = render(
      <LegalDocumentEditor doc={makeDoc('t0', '<p>ES0</p>')} />,
    );
    await waitFor(() => expect(h.mountSpy).toHaveBeenCalledTimes(1));

    rerender(
      <LegalDocumentEditor doc={makeDoc('t1', '<p>ES TRANSLATED</p>')} />,
    );

    await waitFor(() => expect(h.mountSpy).toHaveBeenCalledTimes(2));
    expect(h.state.initialHtml).toBe('<p>ES TRANSLATED</p>');
  });
});
