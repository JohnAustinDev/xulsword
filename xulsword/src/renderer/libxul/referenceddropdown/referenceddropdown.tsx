/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import {
  keep,
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  xulStyle,
} from '../xul';
import '../xul.css';

// XUL reference-dropdown
export default function Referencedropdown(props) {
  return (
    <div
      className={xulClass('referencedropdown', props)}
      {...keep(props)}
      style={xulStyle(props)}
    >
      {props.children}
    </div>
  );
}
Referencedropdown.defaultProps = {
  ...xulDefaultProps,
  sizetopopup: null,
  onlybibles: null,
  onlyavailablebooks: null,
};
Referencedropdown.propTypes = {
  ...xulPropTypes,
  sizetopopup: PropTypes.oneOf(['none']),
  onlybibles: PropTypes.oneOf(['true', 'false']),
  onlyavailablebooks: PropTypes.oneOf(['true', 'false']),
};
