import React from 'react';
import { Button as BPButton } from '@blueprintjs/core';
import { keep } from '../../../common.ts';
import C from '../../../constant.ts';
import { htmlAttribs } from './xul.tsx';
import Icon from './icon.tsx';
import './button.css';

import type { ButtonProps as BPButtonProps } from '@blueprintjs/core';
import type { BlueprintIcons_20Id } from '@blueprintjs/icons/lib/esm/generated/20px/blueprint-icons-20.d.ts';
import type { XulProps } from './xul.tsx';

// XUL button
type ButtonProps = Omit<XulProps, 'align' | 'orient' | 'pack'> &
  Omit<BPButtonProps, 'fill' | 'icon'> & {
    icon?: BlueprintIcons_20Id;
    iconSize?: number; // icon size in px
    fill?: 'xy' | 'x' | 'y'; // to fill container in x, y or both directions
    checked?: boolean; // only does button CSS styling
    dlgType?: string; // only does button CSS styling
  };

export default function Button(props: ButtonProps) {
  const {
    checked,
    children,
    disabled,
    dlgType,
    fill,
    icon,
    rightIcon,
    iconSize,
  } = props;
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
  const size = iconSize ?? C.UI.BluePrint.IconSize.LARGE;

  return (
    <div
      {...htmlAttribs(cls.join(' '), props)}
      {...(disabled
        ? { onPointerDown: undefined, onPointerDownCapture: undefined }
        : {})}
    >
      <div className="button-box">
        <BPButton
          {...keep(props, bpprops)}
          icon={icon && <Icon icon={icon} size={size} />}
          rightIcon={rightIcon && <Icon icon={rightIcon} size={size} />}
          fill={!!fill}
        >
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
      {...(disabled
        ? { onPointerDown: undefined, onPointerDownCapture: undefined }
        : {})}
    >
      {props.children}
    </a>
  );
}
