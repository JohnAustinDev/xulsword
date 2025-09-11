import React from 'react';
import { htmlAttribs } from './xul.tsx';
import './boxes.css';

import type { XulProps } from './xul.tsx';

// XUL box
function Box(props: XulProps) {
  return <div {...htmlAttribs('box', props)}>{props.children}</div>;
}

// XUL hbox
function Hbox(props: XulProps) {
  return (
    <Box
      {...props}
      className={`hbox ${props.className ? props.className : ''}`}
    >
      {props.children}
    </Box>
  );
}

// XUL vbox
function Vbox(props: XulProps) {
  return (
    <Box
      {...props}
      className={`vbox ${props.className ? props.className : ''}`}
    >
      {props.children}
    </Box>
  );
}

export { Box, Hbox, Vbox };
