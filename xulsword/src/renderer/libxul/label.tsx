/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { xulClass, xulDefaultProps, xulPropTypes, XulProps } from './xul';
import './xul.css';

// XUL label
function Label(props: LabelProps) {
  let { control } = props;
  if (typeof control === 'string') {
    if (!control.includes('__')) control = `${props.control}__input`;
  } else {
    control = undefined;
  }

  return (
    <label htmlFor={control} className={xulClass('label', props)}>
      {props.value}
    </label>
  );
}
Label.defaultProps = {
  ...xulDefaultProps,
  control: undefined,
};
Label.propTypes = {
  ...xulPropTypes,
  value: PropTypes.string.isRequired,
  control: PropTypes.string,
};

interface LabelProps extends XulProps {
  value: string;
  control?: string | undefined;
}

export default Label;
