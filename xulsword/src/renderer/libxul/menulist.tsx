/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import Tooltip from './tooltip';
import {
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulStyle,
} from './xul';
import { Box } from './boxes';
import './xul.css';

// XUL menulist
const defaultProps = {
  ...xulDefaultProps,
  disabled: false,
  multiple: false,
  options: null,
  size: undefined,
  tooltip: null,
};

const propTypes = {
  ...xulPropTypes,
  disabled: PropTypes.bool,
  multiple: PropTypes.bool,
  options: PropTypes.arrayOf(PropTypes.element),
  size: PropTypes.number,
  tooltip: PropTypes.string,
};

interface MenulistProps extends XulProps {
  disabled?: boolean;
  multiple?: boolean;
  options?: PropTypes.ReactElementLike[];
  size?: number | undefined;
  tooltip?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

function Menulist(props: MenulistProps) {
  return (
    <Box
      id={props.id}
      className={xulClass('menulist', props)}
      style={xulStyle(props)}
    >
      <select
        id={props.id ? `${props.id}__select` : undefined}
        disabled={props.disabled}
        multiple={props.multiple}
        size={props.size}
        onChange={props.onChange}
      >
        {props.options}
      </select>
      <Tooltip tip={props.tooltip} />
    </Box>
  );
}
Menulist.defaultProps = defaultProps;
Menulist.propTypes = propTypes;

export default Menulist;
