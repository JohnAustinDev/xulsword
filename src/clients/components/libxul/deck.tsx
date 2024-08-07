import React from 'react';
import { xulPropTypes, type XulProps, htmlAttribs } from './xul.tsx';

// XUL deck
const propTypes = xulPropTypes;

function Deck(props: XulProps) {
  return <div {...htmlAttribs('deck', props)}>{props.children}</div>;
}
Deck.propTypes = propTypes;

export default Deck;
