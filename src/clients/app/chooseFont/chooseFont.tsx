import type { ReactElementLike } from 'prop-types';
import React from 'react';
import { ChromePicker as ColorPicker } from 'react-color';
import { Slider } from '@blueprintjs/core';
import { diff, normalizeFontFamily } from '../../../common.ts';
import G from '../../rg.ts';
import renderToRoot from '../renderer.tsx';
import log from '../../log.ts';
import { windowArguments } from '../../common.ts';
import { xulPropTypes } from '../../components/libxul/xul.tsx';
import { Hbox, Vbox } from '../../components/libxul/boxes.tsx';
import Groupbox from '../../components/libxul/groupbox.tsx';
import Label from '../../components/libxul/label.tsx';
import Button from '../../components/libxul/button.tsx';
import Checkbox from '../../components/libxul/checkbox.tsx';
import Menulist from '../../components/libxul/menulist.tsx';
import ModuleMenu from '../../components/libxul/modulemenu.tsx';
import Dialog from '../../components/libxul/dialog.tsx';
import Grid, {
  Columns,
  Column,
  Rows,
  Row,
} from '../../components/libxul/grid.tsx';
import Spacer from '../../components/libxul/spacer.tsx';
import handlerH, {
  styleToState,
  startingState,
  setStateValue as setStateValueH,
  preclose,
  computedStyle,
} from './chooseFontH.ts';
import './chooseFont.css';

import type { ColorResult } from 'react-color';
import type { XulProps } from '../../components/libxul/xul.tsx';

const nocolor = { r: 128, g: 128, b: 128, a: 128 };

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

export type ChooseFontWinState = typeof startingState;

export default class ChooseFontWin extends React.Component {
  static propTypes: typeof propTypes;

  value: { [p in keyof ChooseFontWinState]?: ChooseFontWinState[p] };

  handler: (e: React.SyntheticEvent) => void;

  setStateValue: (key: keyof ChooseFontWinState, value?: any) => void;

  constructor(props: ChooseFontWinProps) {
    super(props);

    const { module } = windowArguments('chooseFontState') as { module: string };

    const s: ChooseFontWinState = {
      ...startingState,
      ...styleToState(startingState.style, module),
    };
    this.state = s;

    this.value = {};

    this.handler = handlerH.bind(this);
    this.setStateValue = setStateValueH.bind(this);
  }

  componentDidMount() {
    G.getSystemFonts()
      .then((fonts) => {
        this.setState({ fonts });
        return true;
      })
      .catch((err: Error) => {
        log.error(err);
      });
  }

  componentDidUpdate(_prevProps: any, prevState: ChooseFontWinState) {
    const state = this.state as ChooseFontWinState;
    const { module } = state;
    if (module && diff(prevState.style, state.style) !== undefined) {
      G.Data.write(state.style, 'stylesheetData');
      G.Window.reset('dynamic-stylesheet-reset', 'all');
      log.silly('componentDidUpdate style:', state.style);
    }
    const { value } = this;
    const d = diff(state, value);
    if (d) this.setState(d);
  }

  render() {
    const state = this.state as ChooseFontWinState;
    const { value, handler, setStateValue } = this;
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
      ruSureDialog,
    } = state;

    const fontOptions: ReactElementLike[] = [
      <option key="empty" value="" label={G.i18n.t('choose.label')} />,
    ];
    if (fonts.length) {
      fontOptions.splice(
        1,
        0,
        ...fonts.map((font: string) => {
          return (
            <option key={font} value={font} label={font.replace(/['"]/g, '')} />
          );
        }),
      );
    }

    const disabled = Boolean(
      removeModuleUserStyles || makeDefault || removeAllUserStyles,
    );
    const disableRD = Boolean(makeDefault || removeAllUserStyles);
    const disableMD = Boolean(removeModuleUserStyles || removeAllUserStyles);
    const disableAD = Boolean(removeModuleUserStyles || makeDefault);

    const compute: Array<keyof ChooseFontWinState> = [
      'fontFamily',
      'color',
      'background',
    ];
    const computed = {} as ChooseFontWinState;
    compute.forEach((key) => {
      const x = computed as any;
      x[key] = state[key] || computedStyle(module, key) || startingState[key];
    });
    value.fontFamily = normalizeFontFamily(computed.fontFamily);
    value.color = computed.color || nocolor;
    value.background = null; // disable background, who would use it?
    const { fontFamily, color, background } = value;
    let colorCSS;
    if (color) {
      const { r: cr, g: cg, b: cb, a: ca } = disabled ? nocolor : color;
      colorCSS = `background-color: rgb(${cr}, ${cg}, ${cb}, ${ca});`;
    }
    let backgroundCSS;
    if (background) {
      const { r: br, g: bg, b: bb, a: ba } = disabled ? nocolor : background;
      backgroundCSS = `background-color: rgb(${br}, ${bg}, ${bb}, ${ba});`;
    }

    return (
      <Vbox>
        <style>{`
        #color .color-box {${colorCSS}}
        #background .color-box {${backgroundCSS}}`}</style>
        {ruSureDialog && (
          <Dialog
            body={<>{G.i18n.t('dialog.confirmDelete')}</>}
            buttons={
              <>
                <Spacer flex="10" />
                <Button
                  flex="1"
                  fill="x"
                  onClick={() => {
                    ruSureDialog(false);
                  }}
                >
                  {G.i18n.t('no.label')}
                </Button>
                <Button
                  flex="1"
                  fill="x"
                  onClick={() => {
                    ruSureDialog(true);
                  }}
                >
                  {G.i18n.t('yes.label')}
                </Button>
                <Spacer width="10px" />
              </>
            }
          />
        )}
        <span id="styleTest" />
        <Groupbox caption={G.i18n.t('fontsAndColors.label')}>
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
                  value={`${G.i18n.t('chooseModule.label')}:`}
                />
                <ModuleMenu
                  id="module"
                  value={module || ''}
                  disabled={disabled}
                  onChange={handler}
                />
                <Checkbox
                  id="removeModuleUserStyles"
                  label={G.i18n.t('removeModuleUserStyles.label')}
                  checked={Boolean(removeModuleUserStyles)}
                  disabled={disableRD}
                  onChange={handler}
                />
              </Row>
              <Row>
                <Label
                  control="fontFamily"
                  value={`${G.i18n.t('chooseFont.label')}:`}
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
                  value={`${G.i18n.t('textSize.label')}:`}
                />
                <Slider
                  min={0}
                  max={100}
                  value={fontSize}
                  disabled={disabled}
                  onChange={(val) => {
                    setStateValue('fontSize', val);
                  }}
                  labelRenderer={false}
                />
              </Row>
              <Row>
                <Hbox />
                <Hbox />
                <Label
                  value={`${G.i18n.t('lineHeight.label')}:`}
                  control="lineHeight"
                />
                <Slider
                  min={0}
                  max={100}
                  value={lineHeight}
                  disabled={disabled}
                  onChange={(val) => {
                    setStateValue('lineHeight', val);
                  }}
                  labelRenderer={false}
                />
              </Row>
              <Row>
                <Hbox />
                <Hbox />
                <Label
                  value={`${G.i18n.t('textColor.label')}:`}
                  control="color"
                />
                <Button
                  id="color"
                  className="picker-button"
                  disabled={disabled}
                  onClick={handler}
                >
                  <div className="color-box">
                    {coloropen && (
                      <ColorPicker
                        color={disabled ? nocolor : color}
                        onChange={(c: ColorResult) => {
                          this.setState({ color: c.rgb });
                        }}
                      />
                    )}
                  </div>
                </Button>
              </Row>
              {background && (
                <Row>
                  <Hbox />
                  <Hbox />
                  <Label
                    value={`${G.i18n.t('backgroundColor.label')}:`}
                    control="background"
                  />
                  <Button
                    id="background"
                    className="picker-button"
                    disabled={disabled}
                    onClick={handler}
                  >
                    <div className="color-box">
                      {backgroundopen && (
                        <ColorPicker
                          color={disabled ? nocolor : background}
                          onChange={(c: ColorResult) => {
                            this.setState({ background: c.rgb });
                          }}
                        />
                      )}
                    </div>
                  </Button>
                </Row>
              )}
              <Row>
                <Checkbox
                  id="makeDefault"
                  label={G.i18n.t('makeDefault.label')}
                  checked={Boolean(makeDefault)}
                  disabled={disableMD}
                  onChange={handler}
                />
              </Row>
              <Row>
                <Checkbox
                  id="removeAllUserStyles"
                  label={G.i18n.t('removeAllUserStyles.label')}
                  checked={Boolean(removeAllUserStyles)}
                  disabled={disableAD}
                  onChange={handler}
                />
              </Row>
            </Rows>
          </Grid>
        </Groupbox>

        <Hbox className="dialog-buttons" pack="end" align="end">
          <Spacer flex="10" />
          <Button id="cancel" flex="1" fill="x" onClick={handler}>
            {G.i18n.t('cancel.label')}
          </Button>
          <Button id="ok" flex="1" fill="x" onClick={handler}>
            {G.i18n.t('ok.label')}
          </Button>
        </Hbox>
      </Vbox>
    );
  }
}
ChooseFontWin.propTypes = propTypes;

renderToRoot(<ChooseFontWin height="100%" />, {
  onunload: () => {
    preclose();
  },
}).catch((er) => {
  log.error(er);
});
