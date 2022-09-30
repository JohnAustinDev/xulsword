/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { Box } from './boxes';
import Label from './label';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul';
import './xul.css';
import './button.css';

// XUL button
const defaultProps = {
  ...xulDefaultProps,
  dlgType: '',
  open: false,
  type: 'button',
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
  // The 'checked' prop from is only used by button CSS, to
  // open/close a button menu, use type=menu and render, or
  // not, the button children.
  checked?: boolean | undefined;
  disabled?: boolean | undefined;
  dlgType?: string;
  label?: string | undefined;
  open?: boolean;
  tooltip?: string | undefined;
  type?: string | undefined;
}

function Button(props: ButtonProps) {
  const { align, children, disabled, xuldir, dlgType, label, orient, pack } =
    props;
  const alignx = align !== undefined ? align : 'center';
  const packx = pack !== undefined ? pack : 'center';
  return (
    <button
      {...htmlAttribs(`xsbutton ${dlgType}`, props)}
      disabled={disabled}
      type="button"
    >
      <Box
        className="button-box"
        flex="1"
        align={alignx}
        pack={packx}
        xuldir={xuldir}
        orient={orient}
      >
        <div className="button-icon" />

        {props.label !== undefined && (
          <Label className="button-text" value={label || ''} />
        )}
        {children}
      </Box>

      {props.type === 'menu' && children && (
        <div className="menu">{children}</div>
      )}
    </button>
  );
}
Button.defaultProps = defaultProps;
Button.propTypes = propTypes;

export default Button;
