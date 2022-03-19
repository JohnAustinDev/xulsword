/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import { Vbox } from './boxes';
import { addClass, xulDefaultProps, xulPropTypes, XulProps } from './xul';
import './xul.css';
import './menupopup.css';

// XUL menupopup
const defaultProps = xulDefaultProps;

const propTypes = {
  ...xulPropTypes,
};

function Menupopup(props: XulProps) {
  return (
    <Vbox {...addClass('menupopup', props)} pack="start">
      {props.children}
    </Vbox>
  );
}
Menupopup.defaultProps = defaultProps;
Menupopup.propTypes = propTypes;

export default Menupopup;
