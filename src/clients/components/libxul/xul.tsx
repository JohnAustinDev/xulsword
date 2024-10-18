import PropTypes from 'prop-types';

import type React from 'react';

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
    PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
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
  style?: Record<string, any> | undefined; // correct is: React.CSSProperties | undefined;
  width?: string | number | undefined;
  title?: string | undefined;
} & {
  [k in (typeof xulEvents)[number]]?: (e: any) => void;
} & {
  [k in (typeof xulCaptureEvents)[number]]?: (
    e: React.SyntheticEvent<any>,
  ) => void;
};

// const styles = ['width', 'height', 'flex'];
const enums = ['align', 'xuldir', 'orient', 'pack', 'type'] as const;
const bools = ['checked', 'disabled', 'hidden', 'readonly'] as const;
// const cssAttribs = styles.concat(enums).concat(bools);

// Returns props unchanged except having additional class name(s).
export function addClass<P extends XulProps>(
  classes: string | string[],
  props: P,
): P {
  const c = typeof classes === 'string' ? classes.split(' ') : classes;
  const cp = props.className ? props.className.split(' ') : [];
  const r: P = { ...props };
  r.className = c.concat(cp).filter(Boolean).join(' ');
  return r;
}

// Convert certain XUL props to a corresponding CSS style attribute.
// These props take number values with or without qualifiers
// for XUL backward compatibility.
export function xulStyle(
  props: Record<string, unknown>,
): React.CSSProperties | undefined {
  const s = {} as React.CSSProperties;
  const { width, height, flex } = props;
  // width
  if (typeof width === 'string' || typeof width === 'number')
    s.width = /^\d+$/.test(width.toString()) ? `${width}px` : width;

  // height
  if (typeof height === 'string' || typeof height === 'number')
    s.height = /^\d+$/.test(height.toString()) ? `${height}px` : height;

  // flex
  if (typeof flex === 'string' || typeof flex === 'number') {
    s.flexGrow = flex.toString().replace(/\D/, '');
    s.flexShrink = s.flexGrow;
  }

  return Object.keys(s).length ? s : undefined;
}

// Convert certain XUL props to corresponding CSS classes, adding any
// requested additional classes in the processes.
export function xulClass(
  classes: string | string[],
  props: Record<string, unknown>,
) {
  const c1 = Array.isArray(classes) ? classes : classes.split(/\s+/);
  const c2 = props.className ? (props.className as string).split(/\s+/) : [];
  const c3 = enums.map((c) =>
    props[c] ? `${c}-${props[c] as string | number}` : '',
  );
  const c4 = bools.map((c) => {
    const v = props[c] as boolean | string;
    return v && !/^false$/i.test(v.toString()) ? `${c}` : '';
  });
  const set = [...new Set(c1.concat(c1, c2, c3, c4).filter(Boolean))];
  return { className: set.join(' ') };
}

// Convert all props to corresponding HTML element attribtues.
// This must be used to pass props to all HTML elements but
// should only be used on HTML elements (not on React components).
export function htmlAttribs(
  className: string | string[],
  props: Record<string, unknown>,
): Record<string, unknown> {
  if (props === null) return {};
  const r = {
    ...xulClass(className, props),
  } as Record<string, unknown>;
  xulEvents.forEach((x) => {
    if (typeof props[x] !== 'undefined') r[x] = props[x];
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

  const { style } = props as { style?: React.CSSProperties };
  const styleObj = {
    ...xulStyle(props),
    ...style,
  };
  if (Object.keys(styleObj).length) {
    r.style = styleObj;
  }
  Object.entries(props).forEach((entry) => {
    const [p, val] = entry;
    if (p.substring(0, 5) === 'data-') a[p] = val;
  });

  return r;
}

// Use topHandle() when there is a xulEvent prop on a React component's top-
// level element. Otherwise any event prop of that same type on an instance
// of that component would never be called.
export function topHandle(
  name: (typeof xulEvents)[number] | (typeof xulCaptureEvents)[number],
  func?: (e: React.SyntheticEvent) => any,
  props?: any,
) {
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
}

// Delay any function by ms milliseconds with only a
// single (most recent) instance called after the delay.
export function delayHandler(
  this: unknown,
  handler: (...args: any) => void,
  ms: number | string,
  nameTO: string,
) {
  return (...args: unknown[]) => {
    if (this && typeof this === 'object') {
      if (nameTO in this)
        clearTimeout((this as any)[nameTO] as ReturnType<typeof setTimeout>);
      (this as any)[nameTO] = setTimeout(
        () => {
          handler.call(this, ...args);
        },
        Number(ms) || 0,
      );
    }
  };
}
