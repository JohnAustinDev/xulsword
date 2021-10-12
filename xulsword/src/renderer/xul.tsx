/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/destructuring-assignment */

import React from 'react';
import PropTypes from 'prop-types';
import './xul.global.css';

// These XUL attributes are to be passed down as-is in props
const keep = (props) => {
  return {
    id: props.id,
    lang: props.lang,
    pack: props.pack,
    align: props.align,
  };
};

// Define type checking for XUL attributes
const xulPropTypes = {
  flex: PropTypes.string,
  width: PropTypes.string,
  height: PropTypes.string,
  class: PropTypes.string,
  children: PropTypes.node,
};

// Set default prop values
const xulDefaultProps = {
  flex: null,
  width: null,
  height: null,
  class: null,
  children: null,
};

// Convert these XUL attributes to HTML element CSS style
const xulStyle = (props) => {
  const s = {};
  if (props.width) s.width = props.width.concat('px');
  if (props.height) s.height = props.height.concat('px');
  if (props.flex) s.flexGrow = props.flex;
  return Object.keys(s).length ? s : null;
};

//
// REACT COMPONENT DEFINITIONS FOR XUL UI
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
    <div className={classes.join(' ')} {...keep(props)} style={xulStyle(props)}>
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
    <div className={classes.join(' ')} {...keep(props)} style={xulStyle(props)}>
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
    <div className={classes.join(' ')} {...keep(props)} style={xulStyle(props)}>
      {props.children}
    </div>
  );
}
Hbox.defaultProps = xulDefaultProps;
Hbox.propTypes = xulPropTypes;
export { Hbox };
