import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { LexicalEditor, type LexicalChangePayload } from '../lexical-editor';

// Toolbar is irrelevant to the seeding/feedback-loop contract under test
// and pulls heavy lexical command wiring; stub it out.
vi.mock('../lexical-editor-toolbar', () => ({
  LexicalEditorToolbar: () => null,
}));

const labels = {
  bold: 'b',
  italic: 'i',
  underline: 'u',
  paragraph: 'p',
  h2: 'h2',
  h3: 'h3',
  bulletList: 'ul',
  numberedList: 'ol',
  link: 'l',
  linkPrompt: 'lp',
};

afterEach(cleanup);

// Render a throwaway editor seeded from HTML and capture the real,
// version-correct Lexical state JSON it emits — avoids hand-building
// brittle state fixtures.
async function captureState(html: string): Promise<Record<string, unknown>> {
  let payload: LexicalChangePayload | null = null;
  const { unmount } = render(
    <LexicalEditor
      initialState={null}
      initialHtml={html}
      onChange={(p) => {
        payload = p;
      }}
      toolbarLabels={labels}
    />,
  );
  await waitFor(() => expect(payload).not.toBeNull());
  const state = payload!.state;
  unmount();
  return state;
}

describe('LexicalEditor — seeding contract (no feedback loop)', () => {
  it('seeds editor content from initialState on mount', async () => {
    const alpha = await captureState('<p>ALPHA</p>');
    const { container } = render(
      <LexicalEditor
        initialState={alpha}
        onChange={() => {}}
        toolbarLabels={labels}
      />,
    );
    await waitFor(() =>
      expect(container.textContent).toContain('ALPHA'),
    );
  });

  it('seeds editor content from initialHtml fallback on mount', async () => {
    const { container } = render(
      <LexicalEditor
        initialState={null}
        initialHtml="<p>GAMMA</p>"
        onChange={() => {}}
        toolbarLabels={labels}
      />,
    );
    await waitFor(() =>
      expect(container.textContent).toContain('GAMMA'),
    );
  });

  // THE REGRESSION: a new initialState reference WITHOUT a key change
  // (i.e. the echo of the parent's own onChange) must NOT re-seed the
  // editor. Today this fails: InitialStatePlugin's effect deps include
  // `state`/`html`, so it re-runs setEditorState and clobbers the
  // editor — that is exactly what "kicks the user out" after 1-2 keys.
  it('does NOT re-seed when initialState reference changes but key is stable', async () => {
    const alpha = await captureState('<p>ALPHA</p>');
    const bravo = await captureState('<p>BRAVO</p>');

    const { container, rerender } = render(
      <LexicalEditor
        initialState={alpha}
        onChange={() => {}}
        toolbarLabels={labels}
      />,
    );
    await waitFor(() => expect(container.textContent).toContain('ALPHA'));

    rerender(
      <LexicalEditor
        initialState={bravo}
        onChange={() => {}}
        toolbarLabels={labels}
      />,
    );

    // Give any (buggy) re-seed effect + 300ms debounce time to settle.
    await new Promise((r) => setTimeout(r, 400));
    expect(container.textContent).toContain('ALPHA');
    expect(container.textContent).not.toContain('BRAVO');
  });

  // External resets are intentional and happen via remount (key change):
  // locale tab switch and AI-translate. This must still re-seed.
  it('DOES re-seed when the React key changes (external reset via remount)', async () => {
    const alpha = await captureState('<p>ALPHA</p>');
    const bravo = await captureState('<p>BRAVO</p>');

    const { container, rerender } = render(
      <LexicalEditor
        key="k1"
        initialState={alpha}
        onChange={() => {}}
        toolbarLabels={labels}
      />,
    );
    await waitFor(() => expect(container.textContent).toContain('ALPHA'));

    rerender(
      <LexicalEditor
        key="k2"
        initialState={bravo}
        onChange={() => {}}
        toolbarLabels={labels}
      />,
    );
    await waitFor(() => expect(container.textContent).toContain('BRAVO'));
  });
});
