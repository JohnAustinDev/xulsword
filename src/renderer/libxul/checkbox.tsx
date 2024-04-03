/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { Hbox } from './boxes.tsx';
import Label from './label.tsx';
import { xulDefaultProps, xulPropTypes, XulProps, addClass } from './xul.tsx';
import './checkbox.css';

// XUL button
const defaultProps = xulDefaultProps;

const propTypes = {
  ...xulPropTypes,
  // eslint-disable-next-line react/no-unused-prop-types
  checked: PropTypes.bool,
  disabled: PropTypes.bool,
  label: PropTypes.string,
  initial: PropTypes.bool,
};

interface CheckboxProps extends XulProps {
  checked?: boolean | undefined;
  disabled?: boolean | undefined;
  label?: string | undefined;
  initial?: boolean | undefined;
}

// The Checkbox may either keep its own checked state OR be a
// totally controlled component: If the 'initial' prop is
// undefined, the component will be a totally controlled component
// (no acting state of its own). If the 'initial' prop is
// defined, any checkbox prop value will be ignored.
interface CheckboxState {
  checked: boolean;
}

class Checkbox extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: CheckboxProps) {
    super(props);

    const s: CheckboxState = {
      checked: (props.initial ?? props.checked) || false,
    };
    this.state = s;
  }

  render() {
    const props = this.props as CheckboxProps;
    const state = this.state as CheckboxState;
    const { checked, disabled, label, initial } = props;
    const { checked: checkedState } = state;
    const isChecked = initial === undefined ? checked : checkedState;
    return (
      <Hbox {...addClass('checkbox', props)}>
        <input
          id={`${props.id}__input`}
          checked={isChecked}
          disabled={disabled}
          type="checkbox"
          onChange={() => {
            this.setState({ checked: !checkedState });
          }}
        />
        <Label flex="1" control={`${props.id}__input`} value={label || ''} />
      </Hbox>
    );
  }
}
Checkbox.defaultProps = defaultProps;
Checkbox.propTypes = propTypes;

export default Checkbox;
