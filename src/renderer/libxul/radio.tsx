/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { stringHash } from '../../common';
import { Hbox } from './boxes';
import Label from './label';
import { xulDefaultProps, xulPropTypes, XulProps, addClass } from './xul';
import './xul.css';

// XUL Radio
const defaultProps = {
  ...xulDefaultProps,
  disabled: false,
};

const propTypes = {
  ...xulPropTypes,
  name: PropTypes.string,
  checked: PropTypes.bool,
  disabled: PropTypes.bool,
  label: PropTypes.string,
  value: PropTypes.string,
};

interface RadioProps extends XulProps {
  name: string;
  checked: boolean;
  disabled?: boolean | undefined;
  label: string;
  value: string;
}

function Radio(props: RadioProps) {
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
Radio.defaultProps = defaultProps;
Radio.propTypes = propTypes;

export default Radio;
