/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import Tooltip from '../tooltip/tooltip';
import {
  keep,
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  xulStyle,
} from '../xul';
import '../xul.css';

// XUL stack
export default function Stack(props) {
  return (
    <div
      className={xulClass('stack', props)}
      {...keep(props)}
      style={xulStyle(props)}
    >
      <Tooltip tip={props.tooltip} />
      {props.children}
    </div>
  );
}
Stack.defaultProps = xulDefaultProps;
Stack.propTypes = xulPropTypes;
