/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul';
import './xul.css';

// XUL label
const defaultProps = {
  ...xulDefaultProps,
  control: undefined,
  value: '',
};

const propTypes = {
  ...xulPropTypes,
  control: PropTypes.string,
  value: PropTypes.string,
};

interface LabelProps extends XulProps {
  control?: string | undefined;
  value: string;
}
function Label(props: LabelProps) {
  let { control } = props;
  if (typeof control === 'string') {
    if (!control.includes('__')) control = `${props.control}__input`;
  } else {
    control = undefined;
  }

  return (
    <label htmlFor={control} {...htmlAttribs('label', props)}>
      {props.value}
    </label>
  );
}
Label.defaultProps = defaultProps;
Label.propTypes = propTypes;

export default Label;
