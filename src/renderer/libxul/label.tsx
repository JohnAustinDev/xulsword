/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul.tsx';
import './label.css';

// XUL label
const defaultProps = {
  ...xulDefaultProps,
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
  const { control } = props;

  return (
    <label htmlFor={control} {...htmlAttribs('label', props)}>
      {props.value}
    </label>
  );
}
Label.defaultProps = defaultProps;
Label.propTypes = propTypes;

export default Label;
