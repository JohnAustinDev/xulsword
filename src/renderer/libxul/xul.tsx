/* eslint-disable @typescript-eslint/no-explicit-any */
import PropTypes from 'prop-types';
import React from 'react';

export const xulEvents = [
  'onClick',
  'onDoubleClick',
  'onChange',
  'onKeyDown',
  'onKeyUp',
  'onFocus',
  'onBlur',
  'onMouseDown',
  'onMouseOver',
  'onMouseOut',
  'onMouseMove',
  'onMouseUp',
  'onMouseEnter',
  'onMouseLeave',
  'onWheel',
  'onContextMenu',
] as const;

export const xulCaptureEvents = [
  'onClickCapture',
  'onDoubleClickCapture',
  'onChangeCapture',
  'onKeyDownCapture',
  'onKeyUpCapture',
  'onFocusCapture',
  'onBlurCapture',
  'onMouseDownCapture',
  'onMouseOverCapture',
  'onMouseOutCapture',
  'onMouseMoveCapture',
  'onMouseUpCapture',
  'onWheelCapture',
  'onContextMenuCapture',
] as const;

// Default prop values
export const xulDefaultProps = {};

// PropTypes checking for XUL attributes
export const xulPropTypes = {
  align: PropTypes.oneOf(['start', 'center', 'end', 'baseline', 'stretch']),
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.array]),
  className: PropTypes.string,
  dir: PropTypes.oneOf(['ltr', 'rtl', 'auto']),
  xuldir: PropTypes.oneOf(['reverse']),
  flex: PropTypes.string,
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  hidden: PropTypes.bool,
  id: PropTypes.string,
  lang: PropTypes.string,
  orient: PropTypes.oneOf(['horizontal', 'vertical']),
  pack: PropTypes.oneOf(['start', 'center', 'end']),
  domref: PropTypes.any,
  style: PropTypes.objectOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  ),
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  title: PropTypes.string,

  onClick: PropTypes.func,
  onDoubleClick: PropTypes.func,
  onChange: PropTypes.func,
  onKeyDown: PropTypes.func,
  onKeyUp: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  onMouseDown: PropTypes.func,
  onMouseOver: PropTypes.func,
  onMouseOut: PropTypes.func,
  onMouseMove: PropTypes.func,
  onMouseUp: PropTypes.func,
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onWheel: PropTypes.func,
  onContextMenu: PropTypes.func,
  onClickCapture: PropTypes.func,
  onDoubleClickCapture: PropTypes.func,
  onChangeCapture: PropTypes.func,
  onKeyDownCapture: PropTypes.func,
  onKeyUpCapture: PropTypes.func,
  onFocusCapture: PropTypes.func,
  onBlurCapture: PropTypes.func,
  onMouseDownCapture: PropTypes.func,
  onMouseOverCapture: PropTypes.func,
  onMouseOutCapture: PropTypes.func,
  onMouseMoveCapture: PropTypes.func,
  onMouseUpCapture: PropTypes.func,
  onWheelCapture: PropTypes.func,
  onContextMenuCapture: PropTypes.func,
};

// IDE TypeScript checking for props
export type XulProps = {
  align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch' | undefined;
  children?:
    | React.ReactNode
    | React.ReactNode[]
    | PropTypes.ReactElementLike
    | PropTypes.ReactElementLike[]
    | React.ReactPortal
    | undefined
    | null;
  className?: string | undefined;
  dir?: 'ltr' | 'rtl' | 'auto' | undefined;
  xuldir?: 'reverse' | undefined;
  flex?: string | undefined;
  height?: string | number | undefined;
  hidden?: boolean | undefined;
  id?: string | undefined;
  lang?: string | undefined;
  orient?: 'horizontal' | 'vertical' | undefined;
  pack?: 'start' | 'center' | 'end' | undefined;
  domref?: React.RefObject<any> | undefined;
  style?: React.CSSProperties | undefined;
  width?: string | number | undefined;
  title?: string | undefined;
} & {
  [k in typeof xulEvents[number]]?: (e: React.SyntheticEvent<any>) => void;
} &
  {
    [k in typeof xulCaptureEvents[number]]?: (
      e: React.SyntheticEvent<any>
    ) => void;
  };

// const styles = ['width', 'height', 'flex'];
const enums = ['align', 'xuldir', 'orient', 'pack', 'type'] as const;
const bools = ['checked', 'disabled', 'hidden', 'readonly'] as const;
// const cssAttribs = styles.concat(enums).concat(bools);

// Returns props unchanged except having additional class name(s).
export const addClass = <P extends XulProps>(
  classes: string | string[],
  props: P
): P => {
  const c = typeof classes === 'string' ? classes.split(' ') : classes;
  const cp = props.className ? props.className.split(' ') : [];
  const r: P = { ...props };
  r.className = c.concat(cp).filter(Boolean).join(' ');
  return r;
};

// Convert certain XUL props to a corresponding CSS style attribute.
// These props take number values with or without qualifiers
// for XUL backward compatibility.
export const xulStyle = (props: any): React.CSSProperties | undefined => {
  const s = {} as React.CSSProperties;
  // width
  if (props.width !== undefined)
    s.width = /^\d+$/.test(props.width) ? `${props.width}px` : props.width;

  // height
  if (props.height !== undefined)
    s.height = /^\d+$/.test(props.height) ? `${props.height}px` : props.height;

  // flex
  if (props.flex !== undefined) {
    s.flexGrow = props.flex.replace(/\D/, '');
    s.flexShrink = s.flexGrow;
  }

  return Object.keys(s).length ? s : undefined;
};

// Convert certain XUL props to corresponding CSS classes, adding any
// requested additional classes in the processes.
export const xulClass = (
  classes: string | string[],
  props: XulProps & {
    type: string;
    checked: boolean;
    disabled: boolean;
    readonly: boolean;
  }
) => {
  const c1 = Array.isArray(classes) ? classes : classes.split(/\s+/);
  const c2 = props.className ? props.className.split(/\s+/) : [];
  const c3 = enums.map((c) => (props[c] ? `${c}-${props[c]}` : ''));
  const c4 = bools.map((c) => {
    const v = props[c] as any;
    return v && !/^false$/i.test(v) ? `${c}` : '';
  });
  const set = [...new Set(c1.concat(c1, c2, c3, c4).filter(Boolean))];
  return { className: set.join(' ') };
};

// Convert all props to corresponding HTML element attribtues.
// This must be used to pass props to all HTML elements but
// should only used on HTML elements (not on React components).
export const htmlAttribs = (className: string, props: any) => {
  if (props === null) return {};
  const r = {
    ...xulClass(className, props),
  } as XulProps;
  xulEvents.forEach((x) => {
    if (props[x] !== undefined) r[x] = props[x];
  });
  xulCaptureEvents.forEach((x) => {
    if (props[x] !== undefined) r[x] = props[x];
  });
  const a = r as any;
  if (props.id) r.id = props.id;
  if (props.lang) r.lang = props.lang;
  if (props.domref) a.ref = props.domref;
  if (props.title) r.title = props.title;
  if (props.dir) r.dir = props.dir;
  const style = {
    ...xulStyle(props),
    ...props.style,
  };
  if (Object.keys(style).length) {
    r.style = style;
  }
  Object.entries(props).forEach((entry) => {
    const [p, val] = entry;
    if (p.substring(0, 5) === 'data-') a[p] = val;
  });

  return r;
};

// Use topHandle() when there is a xulEvent prop on a React component's top-
// level element. Otherwise any event prop of that same type on an instance
// of that component would never be called.
export const topHandle = (
  name: typeof xulEvents[number] | typeof xulCaptureEvents[number],
  func?: (e: React.SyntheticEvent) => any,
  props?: any
) => {
  return {
    [name]: (e: React.SyntheticEvent) => {
      if (typeof func === 'function') func(e);
      if (
        !e.isPropagationStopped() &&
        props &&
        typeof props[name] === 'function'
      )
        props[name](e);
    },
  };
};

// Delay any function by ms milliseconds with only a
// single (most recent) instance called after the delay.
export function delayHandler(
  this: any,
  handler: (...args: any) => void | undefined,
  ms: number | string,
  nameTO: string
) {
  return (...args: any[]) => {
    clearTimeout(this[nameTO]);
    this[nameTO] = setTimeout(() => {
      handler.call(this, ...args);
    }, Number(ms) || 0);
  };
}
