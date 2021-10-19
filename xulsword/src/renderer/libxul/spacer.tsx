/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { keep, xulClass, xulDefaultProps, xulPropTypes, xulStyle } from './xul';
import './xul.css';

// XUL spacer
export default function Spacer(props) {
  return (
    <div
      className={xulClass('spacer', props)}
      {...keep(props)}
      style={xulStyle(props)}
    >
      {props.children}
    </div>
  );
}
Spacer.defaultProps = {
  ...xulDefaultProps,
  orient: 'horizontal',
};
Spacer.propTypes = {
  ...xulPropTypes,
  orient: PropTypes.oneOf(['horizontal', 'vertical']),
};
