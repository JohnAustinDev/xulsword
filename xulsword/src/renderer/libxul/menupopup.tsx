/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import {
  keep,
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulStyle,
} from './xul';
import './xul.css';

// XUL menupopup
function Menupopup(props: MenupopupProps) {
  return (
    <div
      className={xulClass('menupopup', props)}
      {...keep(props)}
      style={xulStyle(props)}
    >
      {props.children}
    </div>
  );
}
Menupopup.defaultProps = {
  ...xulDefaultProps,
  onPopupShowing: null,
};
Menupopup.propTypes = {
  ...xulPropTypes,
  onPopupShowing: PropTypes.func,
};

interface MenupopupProps extends XulProps {
  onPopupShowing?: (e: React.SyntheticEvent) => void | null;
}

export default Menupopup;
