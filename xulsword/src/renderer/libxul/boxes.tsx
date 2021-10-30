/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul';
import './xul.css';

// XUL box
const defaultProps = {
  ...xulDefaultProps,
  align: null,
  pack: null,
};

const propTypes = {
  ...xulPropTypes,
  // eslint-disable-next-line react/no-unused-prop-types
  align: PropTypes.string,
  // eslint-disable-next-line react/no-unused-prop-types
  pack: PropTypes.string,
};

function Box(props: XulProps) {
  return <div {...htmlAttribs('box', props)}>{props.children}</div>;
}
Box.defaultProps = defaultProps;
Box.propTypes = propTypes;

// XUL hbox
function Hbox(props: XulProps) {
  return (
    <Box
      {...props}
      className={`hbox ${props.className ? props.className : ''}`}
    >
      {props.children}
    </Box>
  );
}
Hbox.defaultProps = defaultProps;
Hbox.propTypes = propTypes;

// XUL vbox
function Vbox(props: XulProps) {
  return (
    <Box
      {...props}
      className={`vbox ${props.className ? props.className : ''}`}
    >
      {props.children}
    </Box>
  );
}
Vbox.defaultProps = defaultProps;
Vbox.propTypes = propTypes;

export { Box, Hbox, Vbox };
