import { Fragment, type ReactNode } from 'react';

/** Renders a localized string that marks emphasis with `<b>…</b>`; nothing else is interpreted. */
export function Rich({ text }: { text: string }): ReactNode {
  const parts = text.split(/(<b>.*?<\/b>)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('<b>') ? (
          <strong key={i}>{part.slice(3, -4)}</strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
