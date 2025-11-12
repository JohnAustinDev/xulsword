import React from 'react';
import { randomID } from '../../../common.ts';
import { addClass } from './xul.tsx';
import { Box } from './boxes.tsx';
import './menulist.css';

import type { XulProps } from './xul.tsx';

// This is a controlled React component so onChange is required.
//
// NOTES about React select components from https://react.dev/reference/react-dom/components/select:
// - Unlike in HTML, passing a selected attribute to <option> is not supported.
// Instead, use <select defaultValue> for uncontrolled select boxes and
// <select value> for controlled select boxes.
// - If a select box receives a value prop, it will be treated as controlled.
// - A select box can’t be both controlled and uncontrolled at the same time.
// - A select box cannot switch between being controlled or uncontrolled over its lifetime.
// - Every controlled select box needs an onChange event handler that synchronously updates its backing value.

// XUL menulist
export type MenulistProps = {
  disabled?: boolean;
  multiple?: boolean;
  options?: Array<React.ReactElement<HTMLOptionElement>>;
  size?: number | undefined;
  value: string | string[] | number | number[];
  onChange: (e: any) => void | Promise<void>;
} & XulProps;

export default function Menulist({
  disabled = false,
  multiple = false,
  ...props
}: MenulistProps) {
  const { value: val } = props;
  let value: string | string[];
  if (typeof val === 'number') value = String(val);
  else if (Array.isArray(val) && typeof val[0] === 'number')
    value = val.map((v) => String(v));
  else value = val as string | string[];
  return (
    <Box {...addClass('menulist xsinput', props)}>
      <select
        id={props.id ? `${props.id}__select` : randomID()}
        disabled={disabled}
        multiple={multiple}
        size={props.size}
        value={value}
        onChange={() => {}}
      >
        {props.options}
        {props.children}
      </select>
    </Box>
  );
}
