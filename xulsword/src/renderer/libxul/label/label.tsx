/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { xulClass, xulDefaultProps, xulPropTypes } from '../xul';
import '../xul.css';

// XUL label
export default function Label(props) {
  return <span className={xulClass('label', props)}>{props.value}</span>;
}
Label.defaultProps = xulDefaultProps;
Label.propTypes = {
  ...xulPropTypes,
  value: PropTypes.string.isRequired,
};
