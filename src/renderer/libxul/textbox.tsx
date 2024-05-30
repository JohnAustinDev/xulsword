/* eslint-disable react/static-property-placement */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import DOMPurify from 'dompurify';
import { clearPending } from '../rutil.ts';
import {
  delayHandler,
  addClass,
  xulPropTypes,
  XulProps,
} from './xul.tsx';
import { Box } from './boxes.tsx';
import './textbox.css';

const propTypes = {
  ...xulPropTypes,
  maxLength: PropTypes.string,
  multiline: PropTypes.bool,
  pattern: PropTypes.instanceOf(RegExp),
  readonly: PropTypes.bool,
  // eslint-disable-next-line react/forbid-prop-types
  inputRef: PropTypes.object,
  disabled: PropTypes.bool,
  timeout: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  type: PropTypes.oneOf(['search', 'text']),
  value: PropTypes.string,
};

interface TextboxProps extends XulProps {
  maxLength?: string;
  multiline?: boolean;
  pattern?: RegExp;
  readonly?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
  disabled?: boolean;
  timeout?: string | number;
  type?: string;
  value?: string;
}

interface TextboxState {
  value: string;
  lastPropsValue: string;
  lastStateValue: string;
}

type TBevent =
  | React.SyntheticEvent<HTMLInputElement>
  | React.SyntheticEvent<HTMLTextAreaElement>;

// XUL textbox
class Textbox extends React.Component {
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
    const target = e.target as HTMLSelectElement | HTMLTextAreaElement;

    // Test user input against props.pattern and undo mismatched changes,
    // otherwise call the parent's onChange function (using a delay
    // if props.timeout has a value).
    if (!pattern || pattern.test(target.value) || /^\s*$/.test(target.value)) {
      const value = DOMPurify.sanitize(target.value);
      this.setState({ value });
      if (typeof onChange === 'function') {
        delayHandler.bind(this)(
          (evt, currentTarget) => {
            // currentTarget becomes null during the delay, so it must be reset
            evt.currentTarget = currentTarget;
            onChange(evt);
          },
          timeout || 0,
          'changeTO'
        )(e, e.currentTarget);
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
    let { type } = props;
    if (!type) type = 'text';
    const useTextArea = !!(type === 'text' && props.multiline);

    const v = props.disabled ? props.value : state.value;
    const value = DOMPurify.sanitize(v || '');

    return (
      <Box {...addClass('textbox xsinput', props)} onChange={handleChange}>
        {useTextArea && (
          <textarea
            id={`${props.id}__textarea`}
            disabled={props.disabled}
            maxLength={props.maxLength ? Number(props.maxLength) : undefined}
            readOnly={props.readonly}
            value={value}
            onChange={() => {}}
          />
        )}
        {!useTextArea && (
          <input
            id={`${props.id}__input`}
            type={props.type}
            disabled={props.disabled}
            maxLength={props.maxLength ? Number(props.maxLength) : undefined}
            readOnly={props.readonly}
            value={value}
            onChange={() => {}}
            spellCheck={false}
            ref={props.inputRef}
          />
        )}
      </Box>
    );
  }
}
Textbox.propTypes = propTypes;

export default Textbox;
