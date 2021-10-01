/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/destructuring-assignment */

import React from 'react';
import PropTypes from 'prop-types';
import './xul.global.css';

// Convert XUL element attributes to HTML element CSS style
const xulStyle = (props) => {
  const s = {};
  if (props.width) s.width = props.width.concat('px');
  if (props.height) s.height = props.height.concat('px');
  if (props.flex) s['flex-grow'] = props.flex;
  return Object.keys(s).length ? s : null;
};

// Define types for XUL attribute values
const xulPropTypes = {
  flex: PropTypes.oneOf([PropTypes.number, null]),
  width: PropTypes.oneOf([PropTypes.number, null]),
  height: PropTypes.oneOf([PropTypes.number, null]),
  class: PropTypes.oneOf([PropTypes.string, null]),
  children: PropTypes.oneOf([PropTypes.node, null]),
};

// Set default prop values
const xulDefaultProps = {
  flex: null,
  width: null,
  height: null,
  class: null,
  children: null,
};

//
// REACT COMPONENT DEFINITIONS FOR XUL ELEMENTS
//

// XUL label
function Label(props) {
  const classes = ['label', props.class ? props.class.split(' ') : null];
  return <span className={classes.join(' ')}>{props.value}</span>;
}
Label.defaultProps = { class: null };
Label.propTypes = {
  value: PropTypes.string.isRequired,
  class: PropTypes.string,
};
export { Label };

// XUL stack
function Stack(props) {
  const classes = ['stack', props.class ? props.class.split(' ') : null];
  return (
    <div className={classes.join(' ')} {...props} style={xulStyle(props)}>
      {props.children}
    </div>
  );
}
Stack.defaultProps = xulDefaultProps;
Stack.propTypes = xulPropTypes;
export { Stack };

// XUL vbox
function Vbox(props) {
  const classes = ['vbox', props.class ? props.class.split(' ') : null];
  return (
    <div className={classes.join(' ')} {...props} style={xulStyle(props)}>
      {props.children}
    </div>
  );
}
Vbox.defaultProps = xulDefaultProps;
Vbox.propTypes = xulPropTypes;
export { Vbox };

// XUL hbox
function Hbox(props) {
  const classes = ['hbox', props.class ? props.class.split(' ') : null];
  return (
    <div className={classes.join(' ')} {...props} style={xulStyle(props)}>
      {props.children}
    </div>
  );
}
Hbox.defaultProps = xulDefaultProps;
Hbox.propTypes = xulPropTypes;
export { Hbox };
