/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { addClass, xulDefaultProps, xulPropTypes, XulProps } from './xul';
import Label from './label';
import Image from './image';
import './xul.css';
import './groupbox.css';
import { Box, Hbox } from './boxes';

// XUL deck
const defaultProps = {
  ...xulDefaultProps,
  caption: undefined,
  image: undefined,
};

const propTypes = {
  ...xulPropTypes,
  caption: PropTypes.string,
  image: PropTypes.string,
};

type GroupboxProps = XulProps & {
  caption?: string;
  image?: string;
};

function Groupbox(props: GroupboxProps) {
  const { caption, image } = props;
  return (
    <div className="groupbox">
      <Hbox className="groupbox-title" align="start" pack="start">
        {caption && (
          <>
            <Image className="caption-icon" src={image} />
            <Label className="caption-text" flex="1" value={caption} />
          </>
        )}
      </Hbox>
      <Box orient="vertical" {...addClass('groupbox-body', props)}>
        {props.children}
      </Box>
    </div>
  );
}
Groupbox.defaultProps = defaultProps;
Groupbox.propTypes = propTypes;

export default Groupbox;
