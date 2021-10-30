/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
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

const defaultProps = {
  ...xulDefaultProps,
  disabled: false,
  maxLength: undefined,
  multiline: false,
  pattern: null,
  readonly: undefined,
  inputRef: undefined,
  timeout: null,
  tooltip: null,
  type: null,
  value: '',
};

const propTypes = {
  ...xulPropTypes,
  disabled: PropTypes.bool,
  maxLength: PropTypes.string,
  multiline: PropTypes.bool,
  pattern: PropTypes.string,
  readonly: PropTypes.bool,
  // eslint-disable-next-line react/forbid-prop-types
  inputRef: PropTypes.object,
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
  inputRef?: React.RefObject<HTMLInputElement> | undefined;
  timeout?: string | null;
  tooltip?: string | null;
  type?: string | null;
  value?: string;
}

interface TextboxState {
  propValue: string;
  newValue: string;
}

type TBevent =
  | React.ChangeEvent<HTMLInputElement>
  | React.ChangeEvent<HTMLTextAreaElement>;

// XUL textbox
class Textbox extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: TextboxProps) {
    super(props);
    this.state = {
      propValue: props.value,
      newValue: props.value,
    };

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(e: TBevent) {
    const { pattern, timeout, value, onChange } = this.props as TextboxProps;

    // Test user input against props.pattern and undo mismatched changes,
    // otherwise call the parent's onChange function (using a delay
    // if props.timeout has a value).
    const p = pattern ? new RegExp(pattern) : null;
    if (p === null || p.test(e.target.value) || !e.target.value) {
      this.setState({ newValue: e.target.value, propValue: value });
      if (timeout && typeof onChange === 'function') {
        const f = delayHandler.call(this, (evt) => onChange(evt), timeout);
        f(e);
        e.stopPropagation();
      }
    } else {
      this.setState({ propValue: value });
      e.stopPropagation();
    }
  }

  render() {
    const props = this.props as TextboxProps;
    const state = this.state as TextboxState;
    const { handleChange } = this;
    const useTextArea = !!(props.type === 'text' && props.multiline);

    // As a 'Controlled' React input, we use state as the source of
    // truth and overwrite the input's value property with it. But when
    // props.value has been changed, use it to set the new value.
    let { newValue } = state;
    if (
      (typeof props.value === 'string' && props.value !== state.propValue) ||
      newValue === state.propValue
    ) {
      newValue = props.value;
    }

    return (
      <Box {...props} className={xulClass('textbox', props)}>
        {useTextArea && (
          <textarea
            id={`${props.id}__textarea`}
            disabled={props.disabled}
            maxLength={props.maxLength ? Number(props.maxLength) : undefined}
            readOnly={props.readonly}
            value={newValue}
            onChange={handleChange}
          />
        )}
        {!useTextArea && (
          <input
            id={`${props.id}__input`}
            type={props.type ? props.type : 'text'}
            disabled={props.disabled}
            maxLength={props.maxLength ? Number(props.maxLength) : undefined}
            readOnly={props.readonly}
            value={newValue}
            onChange={handleChange}
            ref={props.inputRef}
          />
        )}
        <Tooltip tip={props.tooltip} />
      </Box>
    );
  }
}
Textbox.defaultProps = defaultProps;
Textbox.propTypes = propTypes;

export default Textbox;
