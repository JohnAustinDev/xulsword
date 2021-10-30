/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul';
import './xul.css';

// XUL toolbox
const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

function Toolbox(props: XulProps) {
  return <div {...htmlAttribs('toolbox', props)} />;
}
Toolbox.defaultProps = defaultProps;
Toolbox.propTypes = propTypes;

export default Toolbox;
