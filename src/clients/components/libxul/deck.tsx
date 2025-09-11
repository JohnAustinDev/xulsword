import React from 'react';
import { htmlAttribs } from './xul.tsx';

import type { XulProps } from './xul.tsx';

// XUL deck
export default function Deck(props: XulProps) {
  return <div {...htmlAttribs('deck', props)}>{props.children}</div>;
}
