/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { Button as BPButton } from '@blueprintjs/core';
import type { ButtonProps as BPButtonProps } from '@blueprintjs/core';
import { keep } from '../../common';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul';
import './xul.css';
import './button.css';

// XUL button
const defaultProps = {
  ...xulDefaultProps,
  fill: false,
  checked: false,
  dlgType: undefined,
};

const propTypes = {
  ...xulPropTypes,
  fill: PropTypes.bool,
  checked: PropTypes.bool,
  dlgType: PropTypes.string,
};

type ButtonProps = Omit<XulProps, 'align' | 'orient' | 'pack'> &
  BPButtonProps & {
    fill?: boolean | undefined; // true causes button to fill its parent container
    checked?: boolean | undefined; // only does button CSS styling
    dlgType?: string; // only does button CSS styling
  };

function Button(props: ButtonProps) {
  const { checked, children, disabled, dlgType, fill } = props;
  const cls: string[] = ['button', checked ? 'on' : 'off'];
  if (dlgType) cls.push(dlgType);
  if (fill) cls.push('fill');
  const bpprops = [
    'active',
    'alignText',
    'disabled',
    'elementRef',
    'fill',
    'icon',
    'intent',
    'large',
    'loading',
    'minimal',
    'outlined',
    'rightIcon',
    'small',
    'text',
    'type',
  ];
  return (
    <div
      {...htmlAttribs(cls.join(' '), props)}
      {...(disabled ? { onClick: undefined, onClickCapture: undefined } : {})}
    >
      <div className="button-box">
        <BPButton {...keep(props, bpprops)}>{children}</BPButton>
      </div>
    </div>
  );
}
Button.defaultProps = defaultProps;
Button.propTypes = propTypes;

export default Button;

export function AnchorButton(props: XulProps & { disabled: boolean }) {
  const { disabled } = props;
  return (
    <a
      type="button"
      {...htmlAttribs('anchorbutton', props)}
      {...(disabled ? { onClick: undefined, onClickCapture: undefined } : {})}
    >
      {props.children}
    </a>
  );
}
AnchorButton.defaultProps = { ...xulDefaultProps, disabled: false };
AnchorButton.propTypes = { ...xulPropTypes, disabled: PropTypes.bool };
