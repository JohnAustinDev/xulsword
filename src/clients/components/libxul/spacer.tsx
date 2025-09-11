import React from 'react';
import { htmlAttribs } from './xul.tsx';
import { Box } from './boxes.tsx';

import type { XulProps } from './xul.tsx';

// XUL spacer
type SpacerProps = XulProps & {
  orient?: 'horizontal' | 'vertical';
};

export default function Spacer({
  orient = 'horizontal',
  ...props
}: SpacerProps) {
  return (
    <Box {...htmlAttribs('spacer', { orient, ...props })}>{props.children}</Box>
  );
}
