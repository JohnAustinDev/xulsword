import React from 'react';
import { Hbox } from './boxes.tsx';
import Label from './label.tsx';
import { addClass } from './xul.tsx';
import './checkbox.css';

import type { XulProps } from './xul.tsx';

// The Checkbox may either keep its own checked state OR be a
// totally controlled component: If the 'initial' prop is
// undefined, the component will be a totally controlled component
// (no acting state of its own). If the 'initial' prop is
// defined, any checked prop value will be ignored.

type CheckboxProps = {
  checked?: boolean | undefined;
  disabled?: boolean | undefined;
  label?: string | undefined;
  initial?: boolean | undefined;
} & XulProps;

type CheckboxState = {
  checked: boolean;
};

export default class Checkbox extends React.Component<
  CheckboxProps,
  CheckboxState
> {
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
