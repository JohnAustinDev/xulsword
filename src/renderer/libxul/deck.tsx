/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import { xulPropTypes, XulProps, htmlAttribs } from './xul.tsx';

// XUL deck
const propTypes = xulPropTypes;

function Deck(props: XulProps) {
  return <div {...htmlAttribs('deck', props)}>{props.children}</div>;
}
Deck.propTypes = propTypes;

export default Deck;
