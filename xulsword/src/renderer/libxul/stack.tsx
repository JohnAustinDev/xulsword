/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul';
import './xul.css';

// XUL stack
const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

function Stack(props: XulProps) {
  return <div {...htmlAttribs('stack', props)}>{props.children}</div>;
}
Stack.defaultProps = defaultProps;
Stack.propTypes = propTypes;

export default Stack;
