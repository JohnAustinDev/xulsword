/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import i18n from 'i18next';
import { ChromePicker as ColorPicker } from 'react-color';
import type { ReactElementLike } from 'prop-types';
import C from '../../constant';
import { stringHash } from '../../common';
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
import handlerH, {
  extractModuleStyleState,
  getStyleFromState,
  startingState,
} from './chooseFontH';
import './chooseFont.css';

import type { ModTypes } from '../../type';

window.ipc.renderer.once('close', () => {
  G.globalReset();
  setTimeout(() => {
    G.Data.readAndDelete('stylesheetData');
  }, 3000);
});

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

type ChooseFontWinProps = XulProps;

export type ColorType = {
  r: number;
  g: number;
  b: number;
  a: number;
};

type PickerColorType = {
  rgb: ColorType;
  hex: string;
  hsl: { h: number; s: number; l: number; a: number };
};

export type ChooseFontWinState = typeof startingState;

export default class ChooseFontWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  static fontlist: string[];

  handler: (e: React.SyntheticEvent) => void;

  constructor(props: ChooseFontWinProps) {
    super(props);

    const { module } = windowArgument('chooseFontState') as { module: string };

    this.state = {
      ...startingState,
      ...extractModuleStyleState(module, startingState.style),
    };

    this.handler = handlerH.bind(this);

    G.getSystemFonts()
      .then((fonts) => {
        this.setState({ fonts });
        return fonts;
      })
      .catch((e) => console.log(e));
  }

  componentDidUpdate(_prevProps: any, prevState: ChooseFontWinState) {
    const state = this.state as ChooseFontWinState;
    const { module } = state;
    const style = getStyleFromState(state);
    if (module && stringHash(state.style) !== stringHash(prevState.style)) {
      G.Data.write('stylesheetData', style);
      G.globalReset('parent');
      // console.log(style);
    }
  }

  render() {
    const state = this.state as ChooseFontWinState;
    const { handler } = this;
    const {
      module,
      restoreDefault,
      makeDefault,
      restoreAllDefaults,
      coloropen,
      backgroundopen,
      fonts,
      fontFamily,
      fontSize,
      lineHeight,
      color,
      background,
    } = state;

    const showBackgroundRow = false;
    const fontOptions: ReactElementLike[] | undefined = fonts.map(
      (font: string) => {
        return (
          <option key={font} value={font} label={font.replace(/['"]/g, '')} />
        );
      }
    );
    fontOptions.unshift(
      <option key="empty" value="" label={i18n.t('choose.label')} />
    );

    const nocolor = { r: 128, g: 128, b: 128, a: 128 };
    const fc = color || nocolor;
    const bc = background || nocolor;

    const disabled = Boolean(
      restoreDefault || makeDefault || restoreAllDefaults
    );
    const disableRD = Boolean(makeDefault || restoreAllDefaults);
    const disableMD = Boolean(restoreDefault || restoreAllDefaults);
    const disableAD = Boolean(restoreDefault || makeDefault);

    return (
      <Vbox>
        <style>{`
        #color .button-icon {
          background-color: rgb(${fc.r}, ${fc.g}, ${fc.b}, ${fc.a});
        }
        #background .button-icon {
          background-color: rgb(${bc.r}, ${bc.g}, ${bc.b}, ${bc.a});
        }`}</style>
        <Groupbox caption={i18n.t('fontsAndColors.label')}>
          <Grid id="fontsGrid">
            <Columns>
              <Column width="min-content" />
              <Column />
              <Column width="min-content" />
              <Column />
            </Columns>
            <Rows>
              <Row>
                <Label
                  control="module"
                  value={`${i18n.t('chooseModule.label')}:`}
                />
                <Menulist
                  id="module"
                  value={module || ''}
                  disabled={disabled}
                  onChange={handler}
                >
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
                  checked={Boolean(restoreDefault)}
                  disabled={disableRD}
                  onChange={handler}
                />
              </Row>
              <Row>
                <Label
                  control="fontFamily"
                  value={`${i18n.t('chooseFont.label')}:`}
                />
                <Menulist
                  id="fontFamily"
                  value={fontFamily}
                  options={fontOptions}
                  disabled={disabled}
                  onChange={handler}
                />
                <Label
                  control="fontSize"
                  value={`${i18n.t('textSize.label')}:`}
                />
                <Menulist
                  id="fontSize"
                  value={fontSize}
                  disabled={disabled}
                  onChange={handler}
                >
                  <option value="" label={i18n.t('choose.label')} />
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
                <Menulist
                  id="lineHeight"
                  value={lineHeight}
                  disabled={disabled}
                  onChange={handler}
                >
                  <option value="" label={i18n.t('choose.label')} />
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
                <Button
                  id="color"
                  className="picker-button"
                  type="menu"
                  checked={coloropen}
                  disabled={disabled}
                  onClick={handler}
                >
                  {coloropen && (
                    <ColorPicker
                      color={fc}
                      defaultView="rgb"
                      onChange={(c: PickerColorType) => {
                        this.setState({ color: c.rgb });
                      }}
                    />
                  )}
                </Button>
              </Row>
              {showBackgroundRow && (
                <Row>
                  <Hbox />
                  <Hbox />
                  <Label
                    value={`${i18n.t('backgroundColor.label')}:`}
                    control="background"
                  />
                  <Button
                    id="background"
                    className="picker-button"
                    type="menu"
                    checked={backgroundopen}
                    disabled={disabled}
                    onClick={handler}
                  >
                    {backgroundopen && (
                      <ColorPicker
                        color={bc}
                        defaultView="rgb"
                        onChange={(c: PickerColorType) => {
                          this.setState({ background: c.rgb });
                        }}
                      />
                    )}
                  </Button>
                </Row>
              )}
              <Row>
                <Checkbox
                  id="makeDefault"
                  label={i18n.t('makeDefault.label')}
                  checked={Boolean(makeDefault)}
                  disabled={disableMD}
                  onChange={handler}
                />
              </Row>
              <Row>
                <Checkbox
                  id="restoreAllDefaults"
                  label={i18n.t('restoreAllDefaults.label')}
                  checked={Boolean(restoreAllDefaults)}
                  disabled={disableAD}
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
