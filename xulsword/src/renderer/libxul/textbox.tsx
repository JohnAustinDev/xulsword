/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import Tooltip from './tooltip';
import {
  delayHandler,
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
} from './xul';
import { Box } from './boxes';
import './xul.css';
import './textbox.css';

// XUL textbox
class Textbox extends React.Component {
  static defaultProps: any;

  static propTypes: any;

  constructor(props: TextboxProps) {
    super(props);
    this.state = {
      value: '',
      propValue: undefined,
    };

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(e: TBevent, onChange?: (e: TBevent) => void) {
    const { pattern, value } = this.props as TextboxProps;

    // Test user input against props.pattern and undo mismatched changes
    const p = pattern ? new RegExp(pattern) : null;
    if (p === null || p.test(e.target.value)) {
      this.setState({ value: e.target.value, propValue: value });
      if (typeof onChange === 'function') onChange(e);
    } else {
      this.setState((prevState: TextboxState) => {
        return { value: prevState.value, propValue: value };
      });
    }
  }

  render() {
    const props = this.props as TextboxProps;
    const state = this.state as TextboxState;
    const useTextArea = !!(props.type === 'text' && props.multiline);

    let delayChange = props.onChange;
    if (
      props.onChange !== undefined &&
      typeof delayChange === 'function' &&
      props.timeout
    ) {
      delayChange = delayHandler.call(this, props.onChange, props.timeout);
    }

    // As a 'Controlled' React input, we use state as the source of
    // truth and overwrite the input's value property with it. But when
    // props.value has been changed, use it to set the new value.
    let newValue = state.value;
    if (typeof props.value === 'string' && state.propValue !== props.value) {
      newValue = props.value;
    }

    return (
      <Box
        {...props}
        className={xulClass('textbox', props)}
        onChange={undefined}
      >
        {useTextArea && (
          <textarea
            id={`${props.id}__input`}
            disabled={props.disabled}
            maxLength={props.maxLength}
            readOnly={props.readonly}
            value={newValue}
            onChange={(e) => this.handleChange(e, delayChange)}
          />
        )}
        {!useTextArea && (
          <input
            id={`${props.id}__input`}
            type={props.type ? props.type : 'text'}
            disabled={props.disabled}
            maxLength={props.maxLength}
            readOnly={props.readonly}
            value={newValue}
            onChange={(e) => this.handleChange(e, delayChange)}
          />
        )}
        <Tooltip tip={props.tooltip} />
      </Box>
    );
  }
}
Textbox.defaultProps = {
  ...xulDefaultProps,
  disabled: false,
  maxLength: undefined,
  multiline: false,
  pattern: null,
  readonly: undefined,
  timeout: null,
  tooltip: null,
  type: null,
  value: null,
};
Textbox.propTypes = {
  ...xulPropTypes,
  disabled: PropTypes.bool,
  maxLength: PropTypes.number,
  multiline: PropTypes.bool,
  pattern: PropTypes.string,
  readonly: PropTypes.bool,
  timeout: PropTypes.string,
  tooltip: PropTypes.string,
  type: PropTypes.oneOf(['search']),
  value: PropTypes.string,
};

interface TextboxProps extends XulProps {
  disabled?: boolean | undefined;
  maxLength?: string | undefined;
  multiline?: boolean | null;
  pattern?: string | null;
  readonly?: boolean | undefined;
  timeout?: string | null;
  tooltip?: string | null;
  type?: string | null;
  value?: string | null;
}

interface TextboxState {
  value: string;
  propValue: string;
}

type TBevent =
  | React.ChangeEvent<HTMLInputElement>
  | React.ChangeEvent<HTMLTextAreaElement>;

export default Textbox;
