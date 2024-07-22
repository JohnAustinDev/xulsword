import React from 'react';
import PropTypes from 'prop-types';
import { xulPropTypes, type XulProps, htmlAttribs } from './xul.tsx';

// XUL image
const propTypes = {
  ...xulPropTypes,
  src: PropTypes.string,
};

type ImageProps = {
  src: string | undefined;
} & XulProps;
function Image(props: ImageProps) {
  return <img {...htmlAttribs('image', props)} src={props.src} alt="" />;
}
Image.propTypes = propTypes;

export default Image;
