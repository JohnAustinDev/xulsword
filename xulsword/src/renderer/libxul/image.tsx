/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { keep, xulClass, xulDefaultProps, xulPropTypes, xulStyle } from './xul';
import './xul.css';

// XUL image
export default function Image(props) {
  return (
    <img
      className={xulClass('image', props)}
      src={props.src}
      alt=""
      {...keep(props)}
      style={xulStyle(props)}
    />
  );
}
Image.defaultProps = {
  ...xulDefaultProps,
  src: null,
};
Image.propTypes = {
  ...xulPropTypes,
  src: PropTypes.string,
};
