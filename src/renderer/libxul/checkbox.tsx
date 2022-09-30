/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { Hbox } from './boxes';
import Label from './label';
import { xulDefaultProps, xulPropTypes, XulProps, addClass } from './xul';
import './xul.css';

// XUL button
const defaultProps = xulDefaultProps;

const propTypes = {
  ...xulPropTypes,
  // eslint-disable-next-line react/no-unused-prop-types
  checked: PropTypes.bool,
  disabled: PropTypes.bool,
  label: PropTypes.string,
  tooltip: PropTypes.string,
};

interface CheckboxProps extends XulProps {
  checked?: boolean | undefined;
  disabled?: boolean | undefined;
  label?: string | undefined;
  tooltip?: string | undefined;
}

function Checkbox(props: CheckboxProps) {
  const { checked, disabled, label } = props;
  return (
    <Hbox {...addClass('checkbox', props)}>
      <input
        id={`${props.id}__input`}
        checked={checked}
        disabled={disabled}
        type="checkbox"
        onChange={() => {}}
      />
      <Label flex="1" control={`${props.id}__input`} value={label || ''} />
    </Hbox>
  );
}
Checkbox.defaultProps = defaultProps;
Checkbox.propTypes = propTypes;

export default Checkbox;
