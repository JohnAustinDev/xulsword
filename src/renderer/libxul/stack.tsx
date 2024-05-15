/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import { xulPropTypes, XulProps, htmlAttribs } from './xul.tsx';
import './stack.css';

// XUL stack
const propTypes = xulPropTypes;

function Stack(props: XulProps) {
  return <div {...htmlAttribs('stack', props)}>{props.children}</div>;
}
Stack.propTypes = propTypes;

export default Stack;
