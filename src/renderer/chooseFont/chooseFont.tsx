/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import i18n from 'i18next';
import { ChromePicker as ColorPicker } from 'react-color';
import Slider from 'react-input-slider';
import type { ReactElementLike } from 'prop-types';
import C from '../../constant';
import { diff } from '../../common';
import G from '../rg';
import renderToRoot from '../rinit';
import { windowArgument } from '../rutil';
import log from '../log';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import { Hbox, Vbox } from '../libxul/boxes';
import Groupbox from '../libxul/groupbox';
import Label from '../libxul/label';
import Button from '../libxul/button';
import Checkbox from '../libxul/checkbox';
import Menulist from '../libxul/menulist';
import Grid, { Columns, Column, Rows, Row } from '../libxul/grid';
import handlerH, {
  extractModuleStyleState,
  startingState,
  setStateValue as setStateValueH,
  preclose,
  computedStyle,
} from './chooseFontH';
import './chooseFont.css';

import type { ModTypes } from '../../type';

window.ipc.renderer.once('close', () => {
  preclose();
});

const defaultProps = xulDefaultProps;

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

  handler: (e: React.SyntheticEvent) => void;

  setStateValue: (key: keyof ChooseFontWinState, value?: any) => void;

  constructor(props: ChooseFontWinProps) {
    super(props);

    const { module } = windowArgument('chooseFontState') as { module: string };

    this.state = {
      ...startingState,
      ...extractModuleStyleState(module, startingState.style),
    };

    this.handler = handlerH.bind(this);
    this.setStateValue = setStateValueH.bind(this);
  }

  componentDidMount() {
    G.getSystemFonts()
      .then((fonts) => {
        this.setState({ fonts });
        return true;
      })
      .catch((err: Error) => log.error(err));
  }

  componentDidUpdate(_prevProps: any, prevState: ChooseFontWinState) {
    const state = this.state as ChooseFontWinState;
    const { module } = state;
    if (module && diff(prevState.style, state.style) !== undefined) {
      G.Data.write(state.style, 'stylesheetData');
      G.Window.reset('dynamic-stylesheet-reset');
      log.silly('componentDidUpdate style:', state.style);
    }
  }

  render() {
    const state = this.state as ChooseFontWinState;
    const { handler, setStateValue } = this;
    const {
      module,
      makeDefault,
      removeModuleUserStyles,
      removeAllUserStyles,
      coloropen,
      backgroundopen,
      fonts,
      fontSize,
      lineHeight,
    } = state;

    const showBackgroundRow = false;
    const fontOptions: ReactElementLike[] = [
      <option key="empty" value="" label={i18n.t('choose.label')} />,
    ];
    if (fonts) {
      fontOptions.splice(
        1,
        0,
        ...fonts.map((font: string) => {
          return (
            <option key={font} value={font} label={font.replace(/['"]/g, '')} />
          );
        })
      );
    }

    const disabled = Boolean(
      removeModuleUserStyles || makeDefault || removeAllUserStyles
    );
    const disableRD = Boolean(makeDefault || removeAllUserStyles);
    const disableMD = Boolean(removeModuleUserStyles || removeAllUserStyles);
    const disableAD = Boolean(removeModuleUserStyles || makeDefault);

    const compute: (keyof ChooseFontWinState)[] = [
      'fontFamily',
      'color',
      'background',
    ];
    const computed = {} as ChooseFontWinState;
    compute.forEach((key) => {
      const x = computed as any;
      x[key] = state[key] || computedStyle(module, key) || startingState[key];
    });

    const nocolor = { r: 128, g: 128, b: 128, a: 128 };
    const fc = (!disabled && computed.color) || nocolor;
    const bc = (!disabled && computed.background) || nocolor;

    return (
      <Vbox>
        <style>{`
        #color .button-icon {
          background-color: rgb(${fc.r}, ${fc.g}, ${fc.b}, ${fc.a});
        }
        #background .button-icon {
          background-color: rgb(${bc.r}, ${bc.g}, ${bc.b}, ${bc.a});
        }`}</style>
        <span id="styleTest" />
        <Groupbox caption={i18n.t('fontsAndColors.label')}>
          <Grid id="fontsGrid">
            <Columns>
              <Column width="min-content" />
              <Column width="min-content" />
              <Column width="min-content" />
              <Column width="min-content" />
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
                  id="removeModuleUserStyles"
                  label={i18n.t('removeModuleUserStyles.label')}
                  checked={Boolean(removeModuleUserStyles)}
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
                  value={computed.fontFamily}
                  options={fontOptions}
                  disabled={disabled}
                  onChange={handler}
                />
                <Label
                  control="fontSize"
                  value={`${i18n.t('textSize.label')}:`}
                />
                <Slider
                  axis="x"
                  x={fontSize}
                  disabled={disabled}
                  onChange={(val) => {
                    setStateValue('fontSize', val.x);
                  }}
                />
              </Row>
              <Row>
                <Hbox />
                <Hbox />
                <Label
                  value={`${i18n.t('lineHeight.label')}:`}
                  control="lineHeight"
                />
                <Slider
                  axis="x"
                  x={lineHeight}
                  disabled={disabled}
                  onChange={(val) => {
                    setStateValue('lineHeight', val.x);
                  }}
                />
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
                  id="removeAllUserStyles"
                  label={i18n.t('removeAllUserStyles.label')}
                  checked={Boolean(removeAllUserStyles)}
                  disabled={disableAD}
                  onChange={handler}
                />
              </Row>
            </Rows>
          </Grid>
        </Groupbox>

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
