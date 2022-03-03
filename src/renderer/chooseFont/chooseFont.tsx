/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import i18n from 'i18next';
import type { ReactElementLike } from 'prop-types';
import C from '../../constant';
import G from '../rg';
import renderToRoot from '../rinit';
import { windowArgument } from '../rutil';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import { Hbox, Vbox } from '../libxul/boxes';
import Groupbox from '../libxul/groupbox';
import Label from '../libxul/label';
import Button from '../libxul/button';
import Checkbox from '../libxul/checkbox';
import Spacer from '../libxul/spacer';
import Menulist from '../libxul/menulist';
import Grid, { Columns, Column, Rows, Row } from '../libxul/grid';
import handlerH from './chooseFontH';
import './chooseFont.css';

import type { ModTypes } from '../../type';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

type ChooseFontWinProps = XulProps;

type ChooseFontWinState = {
  module: string;
  restoreDefault: boolean;
  fontSize: string;
  lineHeight: string;
  makeDefault: boolean;
  restoreAllDefaults: boolean;
};

export default class ChooseFontWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  static fontlist: string[];

  handler: (e: React.SyntheticEvent) => void;

  constructor(props: ChooseFontWinProps) {
    super(props);

    const initialState: ChooseFontWinState = {
      module: '',
      restoreDefault: false,
      fontSize: '1em',
      lineHeight: '1.6em',
      makeDefault: false,
      restoreAllDefaults: false,
    };

    const windowState = windowArgument(
      'chooseFontState'
    ) as Partial<ChooseFontWinState>;

    this.state = {
      ...initialState,
      ...windowState,
    };

    this.handler = handlerH.bind(this);
  }

  render() {
    const { handler } = this;
    const {
      module,
      restoreDefault,
      fontSize,
      lineHeight,
      makeDefault,
      restoreAllDefaults,
    } = this.state as ChooseFontWinState;

    const showBackgroundRow = false;
    const fontoptions: ReactElementLike[] | undefined = G.SystemFonts.map(
      (font: string) => {
        return (
          <option key={font} value={font} label={font.replace(/['"]/g, '')} />
        );
      }
    );

    return (
      <Vbox>
        <Groupbox caption={i18n.t('fontsAndColors.label')}>
          <Grid id="fontsGrid">
            <Columns>
              <Column />
              <Column />
              <Column />
              <Column />
            </Columns>
            <Rows>
              <Row>
                <Label
                  control="chooseMod"
                  value={`${i18n.t('chooseModule.label')}:`}
                />
                <Hbox pack="start" align="baseline">
                  <Menulist id="chooseMod" value={module}>
                    {Object.keys(C.SupportedModuleTypes).map((typ) => {
                      const type = typ as ModTypes;
                      return (
                        <optgroup
                          key={type}
                          label={i18n.t(C.SupportedModuleTypes[type])}
                        >
                          {G.Tabs.map((tab) => {
                            if (tab.type === type) {
                              return (
                                <option
                                  className={tab.labelClass}
                                  key={tab.module}
                                  value={tab.module}
                                  label={tab.label}
                                />
                              );
                            }
                            return null;
                          }).filter(Boolean)}
                        </optgroup>
                      );
                    })}
                  </Menulist>
                  <Checkbox
                    id="restoreDefault"
                    label={i18n.t('restoreDefault.label')}
                    checked={restoreDefault}
                    onChange={handler}
                  />
                </Hbox>
              </Row>
              <Row>
                <Label
                  control="fontFamily"
                  value={`${i18n.t('chooseFont.label')}:`}
                />
                <Menulist
                  id="fontFamily"
                  options={fontoptions}
                  onChange={handler}
                />
                <Label
                  control="fontSize"
                  value={`${i18n.t('textSize.label')}:`}
                />
                <Menulist id="fontSize" value={fontSize} onChange={handler}>
                  <option value="0.5em" label="0.5em" />
                  <option value="0.7em" label="0.7em" />
                  <option value="0.8em" label="0.8em" />
                  <option value="0.85em" label="0.85em" />
                  <option value="0.9em" label="0.9em" />
                  <option value="0.925em" label="0.925em" />
                  <option value="0.95em" label="0.95em" />
                  <option value="0.975em" label="0.975em" />
                  <option value="1em" label="1em" />
                  <option value="1.025em" label="1.025em" />
                  <option value="1.05em" label="1.05em" />
                  <option value="1.075em" label="1.075em" />
                  <option value="1.1em" label="1.1em" />
                  <option value="1.15em" label="1.15em" />
                  <option value="1.2em" label="1.2em" />
                  <option value="1.3em" label="1.3em" />
                  <option value="1.5em" label="1.5em" />
                </Menulist>
              </Row>
              <Row>
                <Hbox />
                <Hbox />
                <Label
                  value={`${i18n.t('lineHeight.label')}:`}
                  control="lineHeight"
                />
                <Menulist id="lineHeight" value={lineHeight} onChange={handler}>
                  <option value="1.0em" label="1.0em" />
                  <option value="1.2em" label="1.2em" />
                  <option value="1.4em" label="1.4em" />
                  <option value="1.5em" label="1.5em" />
                  <option value="1.6em" label="1.6em" />
                  <option value="1.7em" label="1.7em" />
                  <option value="1.8em" label="1.8em" />
                  <option value="2.0em" label="2.0em" />
                  <option value="2.5em" label="2.5em" />
                </Menulist>
              </Row>
              <Row>
                <Hbox />
                <Hbox />
                <Label
                  value={`${i18n.t('textColor.label')}:`}
                  control="color"
                />
                {/* <colorpicker
                    type="button"
                    id="color"
                    palettename="standard"
                    onchange="chooseFont.update(event);"
                  /> */}
              </Row>
              {showBackgroundRow && (
                <Row>
                  <Hbox />
                  <Hbox />
                  <Label
                    value={`${i18n.t('backgroundColor.label')}:`}
                    control="background"
                  />
                  {/* <colorpicker
                  type="button"
                  id="background"
                  palettename="standard"
                  onchange="chooseFont.update(event);"
                /> */}
                </Row>
              )}
              <Row>
                <Checkbox
                  id="makeDefault"
                  label={i18n.t('makeDefault.label')}
                  checked={makeDefault}
                  onChange={handler}
                />
              </Row>
              <Row>
                <Checkbox
                  id="restoreAllDefaults"
                  label={i18n.t('restoreAllDefaults.label')}
                  checked={restoreAllDefaults}
                  onChange={handler}
                />
              </Row>
            </Rows>
          </Grid>
        </Groupbox>

        <Spacer flex="1" />

        <Hbox className="dialogbuttons" flex="1" pack="end" align="end">
          <Button
            id="cancel"
            label={i18n.t('cancel.label')}
            onClick={handler}
          />
          <Button id="ok" label={i18n.t('ok.label')} onClick={handler} />
        </Hbox>
      </Vbox>
    );
  }
}
ChooseFontWin.defaultProps = defaultProps;
ChooseFontWin.propTypes = propTypes;

renderToRoot(<ChooseFontWin height="100%" />);
