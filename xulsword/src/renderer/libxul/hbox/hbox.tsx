/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import Tooltip from '../tooltip/tooltip';
import {
  keep,
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  xulStyle,
} from '../xul';
import '../xul.css';

// XUL hbox
export default function Hbox(props) {
  return (
    <div
      className={xulClass('hbox', props)}
      {...keep(props)}
      style={xulStyle(props)}
    >
      <Tooltip tip={props.tooltip} />
      {props.children}
    </div>
  );
}
Hbox.defaultProps = {
  ...xulDefaultProps,
  align: null,
  pack: null,
};
Hbox.propTypes = {
  ...xulPropTypes,
  align: PropTypes.string,
  pack: PropTypes.string,
};
