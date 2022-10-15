/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul';

// XUL deck
const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

function Deck(props: XulProps) {
  return <div {...htmlAttribs('deck', props)}>{props.children}</div>;
}
Deck.defaultProps = defaultProps;
Deck.propTypes = propTypes;

export default Deck;
