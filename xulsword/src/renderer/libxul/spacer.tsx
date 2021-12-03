/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul';
import './xul.css';

// XUL spacer
const defaultProps = {
  ...xulDefaultProps,
  orient: 'horizontal',
};

const propTypes = {
  ...xulPropTypes,
  // eslint-disable-next-line react/no-unused-prop-types
  orient: PropTypes.oneOf(['horizontal', 'vertical']),
};

interface SpacerProps extends XulProps {
  orient?: string;
}

function Spacer(props: SpacerProps) {
  return <div {...htmlAttribs('spacer', props)}>{props.children}</div>;
}
Spacer.defaultProps = defaultProps;
Spacer.propTypes = propTypes;

export default Spacer;
