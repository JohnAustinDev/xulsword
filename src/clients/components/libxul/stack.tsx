import React from 'react';
import { htmlAttribs } from './xul.tsx';
import './stack.css';

import type { XulProps } from './xul.tsx';

// XUL stack
export default function Stack(props: XulProps) {
  return <div {...htmlAttribs('stack', props)}>{props.children}</div>;
}
