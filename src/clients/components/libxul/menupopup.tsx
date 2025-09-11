import React from 'react';
import { Vbox } from './boxes.tsx';
import { addClass } from './xul.tsx';
import './menupopup.css';

import type { XulProps } from './xul.tsx';

// XUL menupopup
export default function Menupopup(props: XulProps) {
  return (
    <Vbox {...addClass('menupopup', props)} pack="start">
      {props.children}
    </Vbox>
  );
}
