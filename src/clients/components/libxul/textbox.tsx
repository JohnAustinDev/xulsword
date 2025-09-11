import React from 'react';
import DOMPurify from 'dompurify';
import { clearPending } from '../../common.ts';
import { delayHandler, addClass } from './xul.tsx';
import { Box } from './boxes.tsx';
import './textbox.css';

import type { XulProps } from './xul.tsx';

// The Textbox component always keeps its own state and so is not a fully
// controlled component (unless disabled, in which case it always shows the
// props value) but Textbox is like a controlled component in that whenever
// the value prop changes then state will be reset to the prop value. The
// usual key prop cannot always be used to reset state (see note below).
// The onChange prop must be provided to retrieve or respond to user input.
type TextboxProps = {
  maxLength?: string;
  multiline?: boolean;
  pattern?: RegExp;
  readonly?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
  disabled?: boolean;
  timeout?: string | number;
  type?: string;
  value?: string;
} & XulProps;

type TextboxState = {
  value: string;
  lastPropsValue: string | undefined;
  lastStateValue: string | undefined;
};

type TBevent =
  | React.SyntheticEvent<HTMLInputElement>
  | React.SyntheticEvent<HTMLTextAreaElement>;

// XUL textbox
export default class Textbox extends React.Component<
  TextboxProps,
  TextboxState
> {
  // NOTE: The key method of resetting a React text input to its props value
  // does not work in all Textbox use cases. This is because key causes a new
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
    const { pattern, timeout, onChange } = this.props;
    const target = e.target as HTMLSelectElement | HTMLTextAreaElement;

    // Test user input against props.pattern and undo mismatched changes,
    // otherwise call the parent's onChange function (using a delay
    // if props.timeout has a value).
    if (!pattern || pattern.test(target.value) || /^\s*$/.test(target.value)) {
      const value = DOMPurify.sanitize(target.value);
      this.setState({ value });
      if (typeof onChange === 'function') {
        delayHandler(
          this,
          (evt, currentTarget) => {
            // currentTarget becomes null during the delay, so it must be reset
            evt.currentTarget = currentTarget;
            onChange(evt);
          },
          [e, e.currentTarget],
          timeout || 0,
          'changeTO',
        );
        e.stopPropagation();
      }
    } else {
      e.stopPropagation();
    }
  }

  render() {
    const { props, state, handleChange } = this;
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
