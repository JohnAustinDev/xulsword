/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import {
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulEvents,
} from './xul';
import './xul.css';

// XUL label
const defaultProps = {
  ...xulDefaultProps,
  control: undefined,
  value: '',
};

const propTypes = {
  ...xulPropTypes,
  value: PropTypes.string,
  control: PropTypes.string,
};

interface LabelProps extends XulProps {
  value: string;
  control?: string | undefined;
}
function Label(props: LabelProps) {
  let { control } = props;
  if (typeof control === 'string') {
    if (!control.includes('__')) control = `${props.control}__input`;
  } else {
    control = undefined;
  }

  return (
    <label
      htmlFor={control}
      className={xulClass('label', props)}
      {...xulEvents(props)}
    >
      {props.value}
    </label>
  );
}
Label.defaultProps = defaultProps;
Label.propTypes = propTypes;

export default Label;
