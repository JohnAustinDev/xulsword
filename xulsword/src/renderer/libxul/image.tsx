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

// XUL image
function Image(props: ImageProps) {
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
  src: undefined,
};
Image.propTypes = {
  ...xulPropTypes,
  src: PropTypes.string,
};

interface ImageProps extends XulProps {
  src: string | undefined;
}

export default Image;
