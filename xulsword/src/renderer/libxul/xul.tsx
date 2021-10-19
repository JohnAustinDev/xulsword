import PropTypes from 'prop-types';

// Type checking for XUL attributes
export const xulPropTypes = {
  align: PropTypes.oneOf(['start', 'center', 'end', 'baseline', 'stretch']),
  children: PropTypes.node,
  className: PropTypes.string,
  dir: PropTypes.oneOf(['reverse']),
  flex: PropTypes.string,
  height: PropTypes.string,
  hidden: PropTypes.oneOf(['true', 'false']),
  id: PropTypes.string,
  lang: PropTypes.string,
  orient: PropTypes.oneOf(['horizontal', 'vertical']),
  pack: PropTypes.oneOf(['start', 'center', 'end']),
  width: PropTypes.string,

  onClick: PropTypes.func,
  onKeyUp: PropTypes.func,
};

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
  width: null,

  onClick: null,
  onKeyUp: null,
};

// These XUL attributes are to be kept on their HTML elements,
// so they can be used with events, CSS selectors or javascript.
export const keep = (props) => {
  return {
    id: props.id,
    lang: props.lang,

    onClick: props.onClick,
    onKeyUp: props.onKeyUp,
  };
};

// These XUL attributes number values (with or without qualifiers) are
// converted to a standard HTML element CSS style value.
export const xulStyle = (props) => {
  const s = {};
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

  return Object.keys(s).length ? s : null;
};

// These XUL attribute enums are converted to CSS classes.
export const xulClass = (name: string, props) => {
  const attribs = ['align', 'dir', 'hidden', 'orient', 'pack', 'type'];
  const c0 = [name.toLowerCase(), props.tooltip ? 'tooltip' : ''];
  const c1 = props.className ? props.className.split(/\s+/) : [];
  const c2 = attribs.map((c) => (props[c] ? `${c}-${props[c]}` : ''));
  return c0.concat(c1).concat(c2).filter(Boolean).join(' ');
};

// Use a default if value is null
export const propd = (defVal, value) => {
  return value !== null ? value : defVal;
};
