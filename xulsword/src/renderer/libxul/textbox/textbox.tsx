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

// XUL textbox
export default function Textbox(props) {
  return (
    <div
      className={xulClass('textbox', props)}
      {...keep(props)}
      style={xulStyle(props)}
    >
      <Tooltip tip={props.tooltip} />
    </div>
  );
}
Textbox.defaultProps = {
  ...xulDefaultProps,
  maxlength: null,
  multiline: null,
  readonly: null,
  timeout: null,
  tooltip: null,
  type: null,
  wrap: null,
};
Textbox.propTypes = {
  ...xulPropTypes,
  maxlength: PropTypes.string, // number
  multiline: PropTypes.oneOf(['true', 'false']),
  readonly: PropTypes.oneOf(['true', 'false']),
  timeout: PropTypes.string, // number
  tooltip: PropTypes.string,
  type: PropTypes.oneOf(['search']),
  wrap: PropTypes.oneOf(['virtual']),
};
