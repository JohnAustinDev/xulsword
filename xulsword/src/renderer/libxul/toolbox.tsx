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

// XUL toolbox
function Toolbox(props: XulProps) {
  return (
    <div
      className={xulClass('toolbox', props)}
      {...keep(props)}
      style={xulStyle(props)}
    />
  );
}
Toolbox.defaultProps = xulDefaultProps;
Toolbox.propTypes = xulPropTypes;

export default Toolbox;
