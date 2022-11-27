/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React from 'react';
import i18n from 'i18next';
import G from '../rg';
import renderToRoot from '../renderer';
import { windowArgument } from '../rutil';
import { Hbox, Vbox } from '../libxul/boxes';
import Label from '../libxul/label';
import Stack from '../libxul/stack';
import Button from '../libxul/button';
import Spacer from '../libxul/spacer';
import Modinfo, {
  modinfoParentInitialState,
  modinfoParentHandler as modinfoParentHandlerH,
} from '../libxul/modinfo';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import '../splash/splash.css';
import './about.css';

import type { ModinfoParent } from '../libxul/modinfo';

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

type AboutWinProps = XulProps;

const initialState = {
  showContributors: false as boolean,
  showModules: false as boolean,
  modules: [] as string[],
};

export type AboutWinState = typeof initialState &
  typeof modinfoParentInitialState;

export default class AboutWin extends React.Component implements ModinfoParent {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  modinfoRefs: {
    textarea: React.RefObject<HTMLTextAreaElement>;
    container: React.RefObject<HTMLDivElement>;
  };

  modinfoParentHandler: typeof modinfoParentHandlerH;

  constructor(props: AboutWinProps) {
    super(props);

    const argState = windowArgument(
      'aboutWinState'
    ) as Partial<AboutWinState> | null;

    const s: AboutWinState = {
      ...modinfoParentInitialState,
      ...initialState,
      ...(argState || {}),
    };
    // When no modules are specified, show them all.
    if (!s.modules.length) {
      s.modules = G.Tabs.map((t) => t.module);
    }
    this.state = s;

    this.modinfoRefs = {
      textarea: React.createRef(),
      container: React.createRef(),
    };

    this.modinfoParentHandler = modinfoParentHandlerH.bind(this);
    this.handler = this.handler.bind(this);
  }

  handler(e: React.SyntheticEvent) {
    switch (e.type) {
      case 'click': {
        const target = e.currentTarget as HTMLElement;
        const [id] = target.id.split('.');
        switch (id) {
          case 'showContributors':
          case 'showModules': {
            this.setState((prevState: AboutWinState) => {
              const p = target.id as 'showModules' | 'showContributors';
              return {
                showContributors: false,
                showModules: false,
                [p]: !prevState[p],
              };
            });
            break;
          }
          case 'close': {
            G.Window.close();
            break;
          }
          default:
            throw new Error(`Unhandled click event ${id} in about.tsx`);
        }
        break;
      }
      default:
    }
  }

  render() {
    const state = this.state as AboutWinState;
    const { modules, showModules, showContributors, showConf, editConf } =
      state;
    const { handler, modinfoParentHandler, modinfoRefs } = this;
    const { container, textarea } = modinfoRefs;

    const contributors: string[] =
      (G.Prefs.getComplexValue('Contributors') as string[]) || [];

    return (
      <Vbox id="mainbox">
        {!showModules && (
          <Hbox pack="center" align="center" flex="1">
            <Spacer orient="vertical" flex="1" />
            <Stack>
              <Vbox id="layer1" flex="1" />
              <Vbox id="layer2" flex="1" pack="end">
                <Hbox align="center">
                  <Vbox flex="1" pack="start" align="center">
                    <Label
                      className="splash-text"
                      value={G.Data.read('buildInfo')}
                    />
                    <Label
                      className="splash-text"
                      value={i18n.t('producedBy')}
                    />
                  </Vbox>
                </Hbox>
              </Vbox>
              <Vbox
                id="contributors"
                className={
                  contributors.length && showContributors ? 'show' : 'hide'
                }
                flex="1"
              >
                <div>
                  {contributors.map((t, i) => (
                    <Label key={`cl${i}`} value={t} />
                  ))}
                </div>
              </Vbox>
            </Stack>
            <Spacer orient="vertical" flex="1" />
          </Hbox>
        )}
        {showModules && (
          <Modinfo
            modules={modules}
            showConf={showConf}
            editConf={editConf}
            refs={{ container, textarea }}
            buttonHandler={modinfoParentHandler}
          />
        )}
        <Hbox className="dialog-buttons" pack="end" align="end">
          {!!modules.length && (
            <>
              <Button id="showModules" flex="1" fill="x" onClick={handler}>
                {showModules
                  ? i18n.t('back.label')
                  : i18n.t('chooseModule.label')}
              </Button>

              <Spacer flex="10" />
            </>
          )}
          {contributors.length && (
            <Button
              id="showContributors"
              hidden={showModules}
              flex="1"
              fill="x"
              onClick={handler}
            >
              {showContributors
                ? i18n.t('back.label')
                : i18n.t('contributors.label')}
            </Button>
          )}
          <Spacer flex="10" />
          <Button id="close" flex="1" fill="x" onClick={handler}>
            {i18n.t('close.label')}
          </Button>
        </Hbox>
      </Vbox>
    );
  }
}
AboutWin.defaultProps = defaultProps;
AboutWin.propTypes = propTypes;

renderToRoot(<AboutWin />, { resetOnResize: false });
