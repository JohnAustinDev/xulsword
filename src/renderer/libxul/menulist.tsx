/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { addClass, xulDefaultProps, xulPropTypes, XulProps } from './xul';
import { Box } from './boxes';

// XUL menulist
const defaultProps = {
  ...xulDefaultProps,
  disabled: false,
  multiple: false,
  options: null,
};

const propTypes = {
  ...xulPropTypes,
  disabled: PropTypes.bool,
  multiple: PropTypes.bool,
  options: PropTypes.arrayOf(PropTypes.element),
  size: PropTypes.number,
  value: PropTypes.string,
};

interface MenulistProps extends XulProps {
  disabled?: boolean;
  multiple?: boolean;
  options?: PropTypes.ReactElementLike[];
  size?: number | undefined;
  value?: string | undefined;
}

function Menulist(props: MenulistProps) {
  return (
    <Box {...addClass('menulist', props)}>
      <select
        id={props.id ? `${props.id}__select` : undefined}
        disabled={props.disabled}
        multiple={props.multiple}
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
Menulist.defaultProps = defaultProps;
Menulist.propTypes = propTypes;

export default Menulist;
