/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import {
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulStyle,
  xulEvents,
} from './xul';
import './xul.css';

// XUL image
const defaultProps = {
  ...xulDefaultProps,
  src: undefined,
};
const propTypes = {
  ...xulPropTypes,
  src: PropTypes.string,
};

interface ImageProps extends XulProps {
  src: string | undefined;
}
function Image(props: ImageProps) {
  return (
    <img
      id={props.id}
      className={xulClass('image', props)}
      src={props.src}
      alt=""
      style={xulStyle(props)}
      {...xulEvents(props)}
    />
  );
}
Image.defaultProps = defaultProps;
Image.propTypes = propTypes;

export default Image;
