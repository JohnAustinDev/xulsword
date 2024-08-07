import React from 'react';
import { Vbox } from './boxes.tsx';
import { addClass, xulPropTypes, type XulProps } from './xul.tsx';
import './menupopup.css';

// XUL menupopup
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
Menupopup.propTypes = propTypes;

export default Menupopup;
