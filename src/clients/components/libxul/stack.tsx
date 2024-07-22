import React from 'react';
import { xulPropTypes, type XulProps, htmlAttribs } from './xul.tsx';
import './stack.css';

// XUL stack
const propTypes = xulPropTypes;

function Stack(props: XulProps) {
  return <div {...htmlAttribs('stack', props)}>{props.children}</div>;
}
Stack.propTypes = propTypes;

export default Stack;
