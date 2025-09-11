import React from 'react';
import { htmlAttribs } from './xul.tsx';
import './label.css';

import type { XulProps } from './xul.tsx';

// XUL label
type LabelProps = {
  control?: string | undefined;
  value: string;
} & XulProps;

export default function Label({ value = '', ...props }: LabelProps) {
  const { control } = props;

  return (
    <label htmlFor={control} {...htmlAttribs('label', props)}>
      {value}
    </label>
  );
}
