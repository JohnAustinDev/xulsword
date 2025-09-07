import React from 'react';
import C from '../../../constant.ts';
import { GE as G } from '../../G.ts';
import renderToRoot from '../../controller.tsx';
import { windowArguments } from '../../common.tsx';
import log from '../../log.ts';
import { Hbox, Vbox } from '../../components/libxul/boxes.tsx';
import Label from '../../components/libxul/label.tsx';
import Stack from '../../components/libxul/stack.tsx';
import Button from '../../components/libxul/button.tsx';
import Spacer from '../../components/libxul/spacer.tsx';
import Modinfo, {
  modinfoParentInitialState,
  modinfoParentHandler as modinfoParentHandlerH,
} from '../../components/libxul/modinfo.tsx';
import { type XulProps, xulPropTypes } from '../../components/libxul/xul.tsx';
import '../splashWin/splashWin.css';
import './aboutWin.css';

import type { ModinfoParent } from '../../components/libxul/modinfo.tsx';
import type { SwordConfType } from '../../../type.ts';

const propTypes = xulPropTypes;

type AboutWinProps = XulProps;

const initialState = {
  showContributors: false as boolean,
  showModules: false as boolean,
  configs: [] as SwordConfType[],
};

export type AboutWinState = typeof initialState &
  typeof modinfoParentInitialState;

export default class AboutWin extends React.Component implements ModinfoParent {
  static propTypes: typeof propTypes;

  modinfoRefs: {
    textarea: React.RefObject<HTMLTextAreaElement>;
    container: React.RefObject<HTMLDivElement>;
  };

  modinfoParentHandler: typeof modinfoParentHandlerH;

  constructor(props: AboutWinProps) {
    super(props);

    const argState = windowArguments(
      'aboutWinState',
    ) as Partial<AboutWinState> | null;

    const s: AboutWinState = {
      ...modinfoParentInitialState,
      ...initialState,
      ...(argState || {}),
    };
    // When no modules are specified, show them all.
    if (!s.configs.length) {
      s.configs = Object.values(G.AudioConfs).concat(
        Object.values(G.ModuleConfs),
      );
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
            throw new Error(`Unhandled click event ${id} in aboutWin.tsx`);
        }
        break;
      }
      default:
    }
  }

  render() {
    const state = this.state as AboutWinState;
    const { configs, showModules, showContributors, showConf, editConf } =
      state;
    const { handler, modinfoParentHandler, modinfoRefs } = this;
    const { container, textarea } = modinfoRefs;

    const contributors: string[] =
      (G.Prefs.getComplexValue('global.Contributors') as string[]) || [];

    const overlay = G.inlineFile(
      `xulsword://xsAsset/locales/splash-overlay-${G.i18n.language}.png`,
    );
    const style = overlay ? (
      <style>
        {`html.${G.i18n.language} #layer2 {
            background-image: url(${overlay});
          }`}
      </style>
    ) : undefined;

    const opts = { ns: 'branding' };
    const producedBy = G.i18n.exists('producedBy', opts)
      ? G.i18n.t('producedBy', opts)
      : '';

    return (
      <Vbox id="mainbox">
        {style}
        {!showModules && (
          <Hbox pack="center" align="center" flex="1">
            <Spacer orient="vertical" flex="1" />
            <Stack>
              <Vbox id="layer1" flex="1" />
              <Vbox id="layer2" flex="1" pack="end">
                <Hbox align="center">
                  <Vbox
                    className="splash-text"
                    flex="1"
                    pack="start"
                    align="center"
                  >
                    <Label value={producedBy} />
                    <Spacer />
                    <Label value={G.Data.read('buildInfo')} />
                    <a
                      className="label"
                      target="_blank"
                      rel="noreferrer"
                      href={C.URL}
                    >
                      {C.URL}
                    </a>
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
            configs={configs}
            showConf={showConf}
            editConf={editConf}
            refs={{ container, textarea }}
            buttonHandler={modinfoParentHandler}
          />
        )}
        <Hbox className="dialog-buttons" pack="end" align="end">
          {!!configs.length && (
            <>
              <Button id="showModules" flex="1" fill="x" onClick={handler}>
                {showModules
                  ? G.i18n.t('back.label')
                  : G.i18n.t('chooseModule.label')}
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
                ? G.i18n.t('back.label')
                : G.i18n.t('contributors.label')}
            </Button>
          )}
          <Spacer flex="10" />
          <Button id="close" flex="1" fill="x" onClick={handler}>
            {G.i18n.t('close.label')}
          </Button>
        </Hbox>
      </Vbox>
    );
  }
}
AboutWin.propTypes = propTypes;

renderToRoot(<AboutWin />, { resetOnResize: false }).catch((er) => {
  log.error(er);
});
