/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import {
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulStyle,
} from './xul';
import './xul.css';

// XUL deck
const defaultProps = xulDefaultProps;
const propTypes = xulPropTypes;
function Deck(props: XulProps) {
  return (
    <div
      id={props.id}
      className={xulClass('deck', props)}
      style={xulStyle(props)}
    >
      {props.children}
    </div>
  );
}
Deck.defaultProps = defaultProps;
Deck.propTypes = propTypes;

export default Deck;
