/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import {
  keep,
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulStyle,
} from './xul';
import './xul.css';

// XUL deck
function Deck(props: XulProps) {
  return (
    <div
      className={xulClass('deck', props)}
      {...keep(props)}
      style={xulStyle(props)}
    >
      {props.children}
    </div>
  );
}
Deck.defaultProps = xulDefaultProps;
Deck.propTypes = xulPropTypes;

export default Deck;
