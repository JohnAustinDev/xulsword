/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { addClass, xulDefaultProps, xulPropTypes, XulProps } from './xul';
import Label from './label';
import Image from './image';
import './xul.css';
import './groupbox.css';
import { Hbox, Vbox } from './boxes';

// XUL deck
const defaultProps = xulDefaultProps;

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
    <Vbox {...props} {...addClass('groupbox', props)}>
      <Hbox className="groupbox-title" align="start" pack="start">
        {caption && (
          <>
            <Image className="caption-icon" src={image} />
            <Label className="caption-text" flex="1" value={caption} />
          </>
        )}
      </Hbox>
      <Vbox {...addClass('groupbox-body', props)} flex="1">
        {props.children}
      </Vbox>
    </Vbox>
  );
}
Groupbox.defaultProps = defaultProps;
Groupbox.propTypes = propTypes;

export default Groupbox;
