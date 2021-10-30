/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import {
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulStyle,
} from './xul';
import './xul.css';

// XUL toolbox
const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

function Toolbox(props: XulProps) {
  return (
    <div
      id={props.id}
      className={xulClass('toolbox', props)}
      style={xulStyle(props)}
    />
  );
}
Toolbox.defaultProps = defaultProps;
Toolbox.propTypes = propTypes;

export default Toolbox;
