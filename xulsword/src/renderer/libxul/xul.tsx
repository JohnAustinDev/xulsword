import PropTypes from 'prop-types';

// PropTypes checking for XUL attributes
export const xulPropTypes = {
  align: PropTypes.oneOf(['start', 'center', 'end', 'baseline', 'stretch']),
  children: PropTypes.node,
  className: PropTypes.string,
  dir: PropTypes.oneOf(['reverse']),
  flex: PropTypes.string,
  height: PropTypes.string,
  hidden: PropTypes.bool,
  id: PropTypes.string,
  lang: PropTypes.string,
  orient: PropTypes.oneOf(['horizontal', 'vertical']),
  pack: PropTypes.oneOf(['start', 'center', 'end']),
  style: PropTypes.objectOf(PropTypes.string),
  width: PropTypes.string,

  onClick: PropTypes.func,
  onChange: PropTypes.func,
};

// IDE TypeScript checking for props
export interface XulProps {
  align?: string | null;
  children?:
    | (PropTypes.ReactElementLike | null | false)[]
    | PropTypes.ReactElementLike
    | null
    | false;
  className?: string | null;
  dir?: string | null;
  flex?: string | null;
  height?: string | null;
  hidden?: boolean | null;
  id?: string | null;
  lang?: string | null;
  orient?: string | null;
  pack?: string | null;
  style?: React.CSSProperties | undefined;
  width?: string | null;

  onClick?: (e: React.SyntheticEvent) => void;
  onChange?: (e: React.ChangeEvent<any>) => void;
}

// Default prop values
export const xulDefaultProps = {
  align: null,
  children: null,
  className: null,
  dir: null,
  flex: null,
  hidden: null,
  height: null,
  id: null,
  lang: null,
  orient: null,
  pack: null,
  style: null,
  width: null,

  onClick: null,
  onChange: null,
};

// These XUL attributes are to be kept on their HTML elements,
// so they can be used with events, CSS selectors or javascript.
export const keep = (props: any) => {
  return {
    id: props.id,
    lang: props.lang,

    onClick: props.onClick,
    onChange: props.onChange,
  };
};

// These XUL attributes number values (with or without qualifiers) are
// converted to a standard HTML element CSS style value.
export const xulStyle = (props: any): React.CSSProperties | undefined => {
  const s = {} as React.CSSProperties;
  // width
  if (props.width !== null)
    s.width = /^\d+$/.test(props.width)
      ? props.width.concat('px')
      : props.width;

  // height
  if (props.height !== null)
    s.height = /^\d+$/.test(props.width)
      ? props.height.concat('px')
      : props.height;

  // flex
  if (props.flex !== null)
    s.flexGrow = props.flex.includes('%')
      ? parseFloat(props.flex) / 100.0
      : props.flex;

  return Object.keys(s).length ? s : undefined;
};

// These XUL attribute booleans and enums are converted to CSS classes.
export const xulClass = (name: string, props: any) => {
  const enums = ['align', 'dir', 'orient', 'pack', 'type'];
  const bools = ['checked', 'disabled', 'hidden', 'readonly'];

  const c0 = [name.toLowerCase(), props.tooltip ? 'tooltip' : ''];
  const c1 = props.className ? props.className.split(/\s+/) : [];
  const c2 = enums.map((c) => (props[c] ? `${c}-${props[c]}` : ''));
  const c3 = bools.map((c) =>
    props[c] && !/^false$/i.test(props[c]) ? `${c}` : ''
  );
  const set = [...new Set(c0.concat(c1, c2, c3).filter(Boolean))];
  return set.join(' ');
};

// Use a default if value is null
export const propd = (defVal: any, value: any) => {
  return value !== null ? value : defVal;
};

// Delay an event handler by ms milliseconds. Any previously scheduled
// handler call will be cancelled if called like this:
// delayHandler.call(this, callback, ...args)
export function delayHandler(callback: (...args: any) => void, ms: number) {
  return (...args: any[]) => {
    clearTimeout(this.delayHandlerTO);
    this.delayHandlerTO = setTimeout(() => {
      callback.call(this, ...args);
    }, ms || 0);
  };
}
