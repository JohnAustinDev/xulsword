/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { keep, xulClass, xulDefaultProps, xulPropTypes, xulStyle } from './xul';
import './xul.css';

// XUL box
export function Box(props) {
  return (
    <div
      className={xulClass('box', props)}
      {...keep(props)}
      style={xulStyle(props)}
    >
      {props.children}
    </div>
  );
}
Box.defaultProps = {
  ...xulDefaultProps,
  align: null,
  pack: null,
};
Box.propTypes = {
  ...xulPropTypes,
  align: PropTypes.string,
  pack: PropTypes.string,
};

// XUL hbox
export function Hbox(props) {
  return (
    <Box
      {...props}
      className={`hbox ${props.className ? props.className : ''}`}
    >
      {props.children}
    </Box>
  );
}
Hbox.defaultProps = Box.defaultProps;
Hbox.propTypes = Box.propTypes;

// XUL vbox
export function Vbox(props) {
  return (
    <Box
      {...props}
      className={`vbox ${props.className ? props.className : ''}`}
    >
      {props.children}
    </Box>
  );
}
Vbox.defaultProps = Box.defaultProps;
Vbox.propTypes = Box.propTypes;
