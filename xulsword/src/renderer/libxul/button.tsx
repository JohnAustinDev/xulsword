/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { Box } from './boxes';
import Label from './label';
import Menupopup from './menupopup';
import Tooltip from './tooltip';
import {
  keep,
  propd,
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  xulStyle,
} from './xul';
import './xul.css';
import './button.css';

// XUL button
export default function Button(props) {
  return (
    <button
      type="button"
      className={xulClass('button', props)}
      {...keep(props)}
      style={xulStyle(props)}
    >
      <Box
        className="button-box"
        align={propd('center', props.align)}
        pack={propd('center', props.pack)}
        flex="1"
        dir={props.dir}
        orient={props.orient}
      >
        <div className="button-icon" />
        {props.label !== null && (
          <Label className="button-text" value={props.label} />
        )}
        {props.type === 'menu' && <Menupopup />}
      </Box>
      <Tooltip tip={props.tooltip} />
    </button>
  );
}
Button.defaultProps = {
  ...xulDefaultProps,
  checked: null,
  disabled: null,
  dlgType: null,
  image: null,
  label: null,
  tooltip: null,
  type: null,
};
Button.propTypes = {
  ...xulPropTypes,
  checked: PropTypes.bool,
  disabled: PropTypes.oneOf(['true', 'false']),
  dlgType: PropTypes.oneOf(['accept', 'cancel']),
  image: PropTypes.string,
  label: PropTypes.string,
  tooltip: PropTypes.string,
  type: PropTypes.oneOf(['button', 'menu']),
};
