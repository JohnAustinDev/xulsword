/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { xulPropTypes, XulProps, htmlAttribs } from './xul.tsx';

// XUL image
const propTypes = {
  ...xulPropTypes,
  src: PropTypes.string,
};

interface ImageProps extends XulProps {
  src: string | undefined;
}
function Image(props: ImageProps) {
  return <img {...htmlAttribs('image', props)} src={props.src} alt="" />;
}
Image.propTypes = propTypes;

export default Image;
