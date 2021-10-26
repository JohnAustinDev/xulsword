/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { XulProps } from './xul';
import './xul.css';

// Tooltip called by other XUL elements
function Tooltip(props: TooltipProps) {
  if (!props.tip || typeof props.tip !== 'string') return null;
  return <span className="tooltiptext">{props.tip}</span>;
}
Tooltip.defaultProps = { tip: null };
Tooltip.propTypes = { tip: PropTypes.string };

interface TooltipProps extends XulProps {
  tip: string | null;
}

export default Tooltip;
