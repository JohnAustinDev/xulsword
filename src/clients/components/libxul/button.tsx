import React from 'react';
import { Button as BPButton } from '@blueprintjs/core';
import { keep } from '../../../common.ts';
import { htmlAttribs } from './xul.tsx';
import './button.css';

import type { ButtonProps as BPButtonProps } from '@blueprintjs/core';
import type { XulProps } from './xul.tsx';

// XUL button
type ButtonProps = Omit<XulProps, 'align' | 'orient' | 'pack'> &
  Omit<BPButtonProps, 'fill'> & {
    fill?: 'xy' | 'x' | 'y'; // to fill container in x, y or both directions
    checked?: boolean; // only does button CSS styling
    dlgType?: string; // only does button CSS styling
  };

export default function Button(props: ButtonProps) {
  const { checked, children, disabled, dlgType, fill } = props;
  const cls: string[] = ['button', checked !== false ? 'on' : 'off'];
  if (dlgType) cls.push(dlgType);
  if (fill) cls.push(`fill-${fill}`);
  const bpprops = [
    'active',
    'alignText',
    'disabled',
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
  ] as const;
  return (
    <div
      {...htmlAttribs(cls.join(' '), props)}
      {...(disabled ? { onClick: undefined, onClickCapture: undefined } : {})}
    >
      <div className="button-box">
        <BPButton {...keep(props, bpprops)} fill={!!fill}>
          {children}
        </BPButton>
      </div>
    </div>
  );
}

export function AnchorButton({
  disabled = false,
  ...props
}: XulProps & { disabled?: boolean }) {
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
