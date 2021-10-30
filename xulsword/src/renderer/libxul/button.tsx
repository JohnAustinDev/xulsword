/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { Box } from './boxes';
import Label from './label';
import Menupopup from './menupopup';
import Tooltip from './tooltip';
import {
  propd,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  htmlAttribs,
} from './xul';
import './xul.css';
import './button.css';

// XUL button
const defaultProps = {
  ...xulDefaultProps,
  checked: undefined,
  disabled: undefined,
  dlgType: '',
  label: null,
  open: false,
  tooltip: null,
  type: null,
};

const propTypes = {
  ...xulPropTypes,
  // eslint-disable-next-line react/no-unused-prop-types
  checked: PropTypes.bool,
  disabled: PropTypes.bool,
  dlgType: PropTypes.oneOf(['accept', 'cancel', '']),
  label: PropTypes.string,
  open: PropTypes.bool,
  tooltip: PropTypes.string,
  type: PropTypes.oneOf(['button', 'menu']),
};

interface ButtonProps extends XulProps {
  checked?: boolean | undefined;
  disabled?: boolean | undefined;
  dlgType?: string;
  label?: string | null;
  open?: boolean;
  tooltip?: string | null;
  type?: string | null;
}

function Button(props: ButtonProps) {
  return (
    <button
      {...htmlAttribs(`button ${props.dlgType}`, props)}
      disabled={props.disabled}
      type="button"
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

        {props.type === 'menu' && <Menupopup id={`${props.id}__menu`} />}
      </Box>
      <Tooltip tip={props.tooltip} />
    </button>
  );
}
Button.defaultProps = defaultProps;
Button.propTypes = propTypes;

export default Button;
