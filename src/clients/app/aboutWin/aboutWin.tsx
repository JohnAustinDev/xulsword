import React from 'react';
import C from '../../../constant.ts';
import { GE as G } from '../../G.ts';
import renderToRoot from '../../controller.tsx';
import { windowArguments } from '../../common.ts';
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
import '../app.css';
import '../splashWin/splashWin.css';
import './aboutWin.css';

import type { SwordConfType } from '../../../type.ts';
import type { ModinfoParent } from '../../components/libxul/modinfo.tsx';
import type { XulProps } from '../../components/libxul/xul.tsx';

type AboutWinProps = XulProps;

const initialState = {
  showContributors: false as boolean,
  showModules: false as boolean,
  showLog: false as boolean,
  logfile: { path: '', contents: '' } as { path: string; contents: string },
  configs: [] as SwordConfType[],
};

export type AboutWinState = typeof initialState &
  typeof modinfoParentInitialState;

export default class AboutWin
  extends React.Component<AboutWinProps, AboutWinState>
  implements ModinfoParent
{
  modinfoRefs: {
    textarea: React.RefObject<HTMLTextAreaElement>;
    container: React.RefObject<HTMLDivElement>;
  };

  modinfoParentHandler: typeof modinfoParentHandlerH;

  logTextarea: React.RefObject<HTMLTextAreaElement>;

  constructor(props: AboutWinProps) {
    super(props);

    const argState = windowArguments(
      'aboutWinState',
    ) as Partial<AboutWinState> | null;

    const s = {
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

    this.logTextarea = React.createRef();

    this.modinfoParentHandler = modinfoParentHandlerH.bind(this);
    this.handler = this.handler.bind(this);
  }

  componentDidUpdate(_prevProps: AboutWinProps, prevState: AboutWinState) {
    const { showLog, logfile } = this.state;
    const { current } = this.logTextarea;
    // Scroll to the newest log entries.
    if (
      current &&
      showLog &&
      (!prevState.showLog || prevState.logfile !== logfile)
    ) {
      current.scrollTop = current.scrollHeight;
    }
  }

  handler(e: React.SyntheticEvent) {
    switch (e.type) {
      case 'pointerdown': {
        const target = e.currentTarget as HTMLElement;
        const [id] = target.id.split('.');
        switch (id) {
          case 'showContributors':
          case 'showModules':
          case 'showLog': {
            const p = target.id as
              | 'showModules'
              | 'showContributors'
              | 'showLog';
            const logfile =
              p === 'showLog' && !this.state.showLog
                ? G.readLogFile()
                : initialState.logfile;
            this.setState((prevState) => {
              const s = {
                showContributors: false,
                showModules: false,
                showLog: false,
                logfile,
              };
              s[p] = !prevState[p];
              return s;
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
    const { state, handler, modinfoParentHandler, modinfoRefs } = this;
    const {
      configs,
      showModules,
      showContributors,
      showLog,
      logfile,
      showConf,
      editConf,
    } = state;
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

    // Only visible buttons are included, so they remain evenly spaced.
    const buttons: React.JSX.Element[] = [];
    if (configs.length && !showLog) {
      buttons.push(
        <Button
          key="showModules"
          id="showModules"
          flex="1"
          fill="x"
          onPointerDown={handler}
        >
          {showModules
            ? G.i18n.t('back.label')
            : G.i18n.t('chooseModule.label')}
        </Button>,
      );
    }
    if (contributors.length && !showModules && !showLog) {
      buttons.push(
        <Button
          key="showContributors"
          id="showContributors"
          flex="1"
          fill="x"
          onPointerDown={handler}
        >
          {showContributors
            ? G.i18n.t('back.label')
            : G.i18n.t('contributors.label')}
        </Button>,
      );
    }
    if (!showModules) {
      buttons.push(
        <Button
          key="showLog"
          id="showLog"
          flex="1"
          fill="x"
          onPointerDown={handler}
        >
          {showLog ? G.i18n.t('back.label') : G.i18n.t('showLog.label')}
        </Button>,
      );
    }
    buttons.push(
      <Button key="close" id="close" flex="1" fill="x" onPointerDown={handler}>
        {G.i18n.t('close.label')}
      </Button>,
    );

    return (
      <Vbox id="mainbox">
        {style}
        {!showModules && !showLog && (
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
        {showLog && (
          <Vbox id="logView" flex="1">
            <div className="log-path">{logfile.path}</div>
            <textarea
              ref={this.logTextarea}
              className="log-text"
              readOnly
              value={logfile.contents}
            />
          </Vbox>
        )}
        <Hbox className="dialog-buttons" pack="end" align="end">
          {buttons.map((b, i) =>
            i ? [<Spacer key={`spacer${i}`} flex="10" />, b] : b,
          )}
        </Hbox>
      </Vbox>
    );
  }
}

renderToRoot(<AboutWin />, { resetOnResize: false }).catch((er) => {
  log.error(er);
});
