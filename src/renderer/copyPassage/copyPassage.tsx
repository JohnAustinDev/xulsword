/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React, { ReactElement } from 'react';
import G from '../rg';
import renderToRoot from '../renderer';
import log from '../log';
import { windowArgument } from '../rutil';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import Grid, { Column, Columns, Row, Rows } from '../libxul/grid';
import Groupbox from '../libxul/groupbox';
import Checkbox from '../libxul/checkbox';
import { Hbox } from '../libxul/boxes';
import Button from '../libxul/button';
import Spacer from '../libxul/spacer';
import VKSelect, { SelectVKMType } from '../libxul/vkselect';

import type { ShowType } from '../../type';

import './copyPassage.css';

const openedWinState = windowArgument(
  'copyPassageState'
) as Partial<CopyPassageState> | null;

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

type CopyPassageProps = XulProps;

export type CopyPassageState = {
  passage: SelectVKMType | null;
  checkboxes: {
    [k in keyof ShowType]?: boolean;
  };
};

export default class CopyPassageWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: CopyPassageProps) {
    super(props);

    const s: CopyPassageState = {
      passage: null,
      checkboxes: {
        headings: false,
        versenums: false,
        redwords: false,
      },
      ...openedWinState,
    };
    this.state = s;
  }

  render() {
    return <></>;
  }
}
CopyPassageWin.defaultProps = defaultProps;
CopyPassageWin.propTypes = propTypes;

renderToRoot(<CopyPassageWin />);
