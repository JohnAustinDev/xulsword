/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { Hbox } from './boxes';
import Label from './label';
import { xulDefaultProps, xulPropTypes, XulProps, addClass } from './xul';
import './xul.css';
import './checkbox.css';

// XUL button
const defaultProps = {
  ...xulDefaultProps,
  checked: undefined,
  disabled: undefined,
  label: undefined,
  tooltip: undefined,
  onChange: undefined,
};

const propTypes = {
  ...xulPropTypes,
  // eslint-disable-next-line react/no-unused-prop-types
  checked: PropTypes.bool,
  disabled: PropTypes.bool,
  label: PropTypes.string,
  tooltip: PropTypes.string,
  onChange: PropTypes.func,
};

interface CheckboxProps extends XulProps {
  checked?: boolean | undefined;
  disabled?: boolean | undefined;
  label?: string | undefined;
  tooltip?: string | undefined;
  onChange?: (e: React.ChangeEvent) => void | undefined;
}

function Checkbox(props: CheckboxProps) {
  const { checked, disabled, label, tooltip, onChange } = props;
  return (
    <Hbox {...addClass('checkbox', props)} title={tooltip} onChange={undefined}>
      <input
        id={`${props.id}__input`}
        checked={checked}
        disabled={disabled}
        type="checkbox"
        onChange={onChange}
      />
      <Label flex="1" control={`${props.id}__input`} value={label} />
    </Hbox>
  );
}
Checkbox.defaultProps = defaultProps;
Checkbox.propTypes = propTypes;

export default Checkbox;
