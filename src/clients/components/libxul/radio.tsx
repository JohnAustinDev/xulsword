import React from 'react';
import { stringHash } from '../../../common.ts';
import { Hbox } from './boxes.tsx';
import Label from './label.tsx';
import { addClass } from './xul.tsx';
import './radio.css';

import type { XulProps } from './xul.tsx';

// XUL Radio
type RadioProps = {
  name: string;
  checked: boolean;
  disabled?: boolean | undefined;
  label: string;
  value: string;
} & XulProps;

export default function Radio(props: RadioProps) {
  const { name, checked, disabled, label, value } = props;
  const key = stringHash(name, value);
  return (
    <Hbox {...addClass('radio', props)}>
      <input
        checked={checked}
        disabled={disabled}
        name={name}
        value={value}
        id={`${key}__input`}
        type="radio"
        onChange={() => {}}
      />
      <Label flex="1" control={`${key}__input`} value={label || ''} />
    </Hbox>
  );
}
