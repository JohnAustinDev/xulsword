/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { clearPending } from '../rutil';
import {
  delayHandler,
  addClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
} from './xul';
import { Box } from './boxes';
import './xul.css';
import './textbox.css';

const defaultProps = {
  ...xulDefaultProps,
  multiline: false,
  readonly: false,
  disabled: false,
  type: 'text',
};

const propTypes = {
  ...xulPropTypes,
  maxLength: PropTypes.string,
  multiline: PropTypes.bool,
  pattern: PropTypes.instanceOf(RegExp),
  readonly: PropTypes.bool,
  // eslint-disable-next-line react/forbid-prop-types
  inputRef: PropTypes.object,
  disabled: PropTypes.bool,
  timeout: PropTypes.string,
  type: PropTypes.oneOf(['search', 'text']),
  value: PropTypes.string,
};

interface TextboxProps extends XulProps {
  maxLength?: string | undefined;
  multiline?: boolean;
  pattern?: RegExp | undefined;
  readonly?: boolean;
  inputRef?: React.RefObject<HTMLInputElement> | undefined;
  disabled?: boolean;
  timeout?: string | undefined;
  type?: string;
  value?: string | undefined;
}

interface TextboxState {
  value: string;
  lastPropsValue: string;
  lastStateValue: string;
}

type TBevent =
  | React.ChangeEvent<HTMLInputElement>
  | React.ChangeEvent<HTMLTextAreaElement>;

// XUL textbox
class Textbox extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  // The key method of resetting a React text input to its props value does
  // not work in all Textbox use cases. This is because key causes a new
  // component to be rendered, causing loss of focus and cursor position.
  // This getDerivedStateFromProps method however does allow higher level
  // components to implement auto-complete etc. without losing the cursor.
  static getDerivedStateFromProps(props: TextboxProps, state: TextboxState) {
    return {
      value:
        props.value !== undefined &&
        (props.value !== state.lastPropsValue ||
          state.value === state.lastStateValue)
          ? props.value
          : state.value,
      lastPropsValue: props.value,
      lastStateValue: state.value,
    };
  }

  changeTO: NodeJS.Timeout | undefined;

  constructor(props: TextboxProps) {
    super(props);
    this.state = {
      value: props.value !== undefined ? props.value : '',
      lastPropsValue: props.value,
      lastStateValue: undefined,
    };

    this.handleChange = this.handleChange.bind(this);
  }

  componentWillUnmount() {
    clearPending(this, 'changeTO');
  }

  handleChange(e: TBevent) {
    const { pattern, timeout, onChange } = this.props as TextboxProps;

    // Test user input against props.pattern and undo mismatched changes,
    // otherwise call the parent's onChange function (using a delay
    // if props.timeout has a value).
    if (
      !pattern ||
      pattern.test(e.target.value) ||
      /^\s*$/.test(e.target.value)
    ) {
      this.setState({ value: e.target.value });
      if (timeout && typeof onChange === 'function') {
        delayHandler.bind(this)((evt) => onChange(evt), timeout, 'changeTO')(e);
        e.stopPropagation();
      }
    } else {
      e.stopPropagation();
    }
  }

  render() {
    const props = this.props as TextboxProps;
    const state = this.state as TextboxState;
    const { handleChange } = this;
    const useTextArea = !!(props.type === 'text' && props.multiline);

    const value = props.disabled ? props.value : state.value;

    return (
      <Box {...addClass('textbox', props)}>
        {useTextArea && (
          <textarea
            id={`${props.id}__textarea`}
            disabled={props.disabled}
            maxLength={props.maxLength ? Number(props.maxLength) : undefined}
            readOnly={props.readonly}
            value={value}
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
            value={value}
            onChange={handleChange}
            ref={props.inputRef}
          />
        )}
      </Box>
    );
  }
}
Textbox.defaultProps = defaultProps;
Textbox.propTypes = propTypes;

export default Textbox;
