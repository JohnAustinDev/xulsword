/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import Tooltip from '../tooltip/tooltip';
import {
  keep,
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  xulStyle,
} from '../xul';
import '../xul.css';

// XUL deck
export default function Deck(props) {
  return (
    <div
      className={xulClass('deck', props)}
      {...keep(props)}
      style={xulStyle(props)}
    >
      <Tooltip tip={props.tooltip} />
      {props.children}
    </div>
  );
}
Deck.defaultProps = xulDefaultProps;
Deck.propTypes = xulPropTypes;
