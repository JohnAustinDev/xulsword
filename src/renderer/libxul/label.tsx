/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { xulPropTypes, type XulProps, htmlAttribs } from './xul.tsx';
import './label.css';

// XUL label
const propTypes = {
  ...xulPropTypes,
  control: PropTypes.string,
  value: PropTypes.string,
};

type LabelProps = {
  control?: string | undefined;
  value: string;
} & XulProps;

function Label({ value = '', ...props }: LabelProps) {
  const { control } = props;

  return (
    <label htmlFor={control} {...htmlAttribs('label', props)}>
      {value}
    </label>
  );
}
Label.propTypes = propTypes;

export default Label;
