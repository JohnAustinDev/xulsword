/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import {
  keep,
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulStyle,
} from './xul';
import './xul.css';

// XUL stack
function Stack(props: XulProps) {
  return (
    <div
      className={xulClass('stack', props)}
      {...keep(props)}
      style={xulStyle(props)}
    >
      {props.children}
    </div>
  );
}
Stack.defaultProps = xulDefaultProps;
Stack.propTypes = xulPropTypes;

export default Stack;
