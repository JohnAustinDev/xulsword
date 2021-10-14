/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/destructuring-assignment */

import React from 'react';
import PropTypes from 'prop-types';
import './xul.css';

// These XUL attributes are to be kept on their HTML elements,
// so they can be used with CSS selectors.
const keep = (props: any) => {
  return {
    align: props.align,
    id: props.id,
    lang: props.lang,
    pack: props.pack,
  };
};

// Define type checking for XUL attributes
const xulPropTypes = {
  align: PropTypes.string,
  children: PropTypes.node,
  class: PropTypes.string,
  flex: PropTypes.string,
  height: PropTypes.string,
  id: PropTypes.string,
  lang: PropTypes.string,
  pack: PropTypes.string,
  width: PropTypes.string,
};

// Set default prop values
const xulDefaultProps = {
  align: null,
  children: null,
  class: null,
  flex: null,
  height: null,
  id: null,
  lang: null,
  pack: null,
  width: null,
};

// Convert these XUL attributes to HTML element CSS style
const xulStyle = (props: any) => {
  const s: any = {};
  if (props.width) s.width = props.width.concat('px');
  if (props.height) s.height = props.height.concat('px');
  if (props.flex) s.flexGrow = props.flex;
  return Object.keys(s).length ? s : null;
};

//
// REACT COMPONENT DEFINITIONS FOR XUL UI
//

// XUL label
function Label(props: any) {
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
function Stack(props: any) {
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
function Vbox(props: any) {
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
function Hbox(props: any) {
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
