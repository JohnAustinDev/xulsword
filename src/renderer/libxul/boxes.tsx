/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import { xulPropTypes, type XulProps, htmlAttribs } from './xul.tsx';
import './boxes.css';

// XUL box
const propTypes = xulPropTypes;

function Box(props: XulProps) {
  return <div {...htmlAttribs('box', props)}>{props.children}</div>;
}
Box.propTypes = propTypes;

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
Hbox.propTypes = propTypes;

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
Vbox.propTypes = propTypes;

export { Box, Hbox, Vbox };
