/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import Tooltip from './tooltip';
import {
  keep,
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulStyle,
} from './xul';
import { Box } from './boxes';
import './xul.css';

// XUL menulist
function Menulist(props: MenulistProps) {
  return (
    <Box
      className={xulClass('menulist', props)}
      {...keep(props)}
      style={xulStyle(props)}
    >
      <select
        id={props.id ? `${props.id}__select` : undefined}
        disabled={props.disabled}
        multiple={props.multiple}
        onChange={props.onChange}
      >
        {props.options}
      </select>
      <Tooltip tip={props.tooltip} />
    </Box>
  );
}
Menulist.propTypes = {
  ...xulPropTypes,
  disabled: PropTypes.bool,
  multiple: PropTypes.bool,
  options: PropTypes.arrayOf(PropTypes.element),
  size: PropTypes.number,
  tooltip: PropTypes.string,
};
Menulist.defaultProps = {
  ...xulDefaultProps,
  disabled: false,
  multiple: false,
  options: null,
  size: 6,
  tooltip: null,
};

interface MenulistProps extends XulProps {
  id?: string | null;
  disabled?: boolean;
  multiple?: boolean;
  options?: PropTypes.ReactElementLike[];
  tooltip?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export default Menulist;
