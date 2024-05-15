/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { addClass, xulPropTypes, XulProps } from './xul.tsx';
import { Box } from './boxes.tsx';
import './menulist.css';

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

interface MenulistProps extends XulProps {
  disabled?: boolean;
  multiple?: boolean;
  options?: React.ReactElement<HTMLOptionElement>[];
  size?: number | undefined;
  value?: string | string[] | undefined;
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
