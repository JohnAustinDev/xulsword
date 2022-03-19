/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul';
import './xul.css';

// XUL image
const defaultProps = xulDefaultProps;

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
Image.defaultProps = defaultProps;
Image.propTypes = propTypes;

export default Image;
