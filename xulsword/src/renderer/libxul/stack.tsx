/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import {
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulStyle,
  xulEvents,
} from './xul';
import './xul.css';

// XUL stack
const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

function Stack(props: XulProps) {
  return (
    <div
      id={props.id}
      className={xulClass('stack', props)}
      style={xulStyle(props)}
      {...xulEvents(props)}
    >
      {props.children}
    </div>
  );
}
Stack.defaultProps = defaultProps;
Stack.propTypes = propTypes;

export default Stack;
