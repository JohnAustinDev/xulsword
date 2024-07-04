/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { addClass, xulPropTypes, XulProps } from './xul.tsx';
import { Box } from './boxes.tsx';
import './menulist.css';

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
const propTypes = {
  ...xulPropTypes,
  disabled: PropTypes.bool,
  multiple: PropTypes.bool,
  options: PropTypes.arrayOf(PropTypes.element),
  size: PropTypes.number,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
};

export interface MenulistProps extends XulProps {
  disabled?: boolean;
  multiple?: boolean;
  options?: React.ReactElement<HTMLOptionElement>[];
  size?: number | undefined;
  value: string | string[];
  onChange: (e: any) => void | Promise<void>;
}

function Menulist({ disabled = false, multiple = false, ...props }: MenulistProps) {
  return (
    <Box {...addClass('menulist xsinput', props)}>
      <select
        id={props.id ? `${props.id}__select` : undefined}
        disabled={disabled}
        multiple={multiple}
        size={props.size}
        value={props.value}
        onChange={() => {}}
      >
        {props.options}
        {props.children}
      </select>
    </Box>
  );
}
Menulist.propTypes = propTypes;

export default Menulist;
