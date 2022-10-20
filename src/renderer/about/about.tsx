/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React from 'react';
import i18n from 'i18next';
import { sanitizeHTML } from '../../common';
import G from '../rg';
import renderToRoot from '../rinit';
import { windowArgument, moduleInfoHTML } from '../rutil';
import { Hbox, Vbox } from '../libxul/boxes';
import Label from '../libxul/label';
import Stack from '../libxul/stack';
import Button from '../libxul/button';
import Spacer from '../libxul/spacer';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import '../libsword.css'; // about uses .head1
import '../splash/splash.css';
import './about.css';

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

type AboutWinProps = XulProps;

const initialState = {
  showContributors: false as boolean,
  showModules: false as boolean,
  modules: [] as string[], // list of module names to be shown when showModules is true
  focusModule: -1 as number, // modules index of a module to be given initial focus, if any
  showConf: -1 as number, // modules index of a module config file to show, if any
  editConf: false as boolean, // is the showConf config file to be editable or not
};

export type AboutWinState = typeof initialState;

export default class AboutWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  textarea: React.RefObject<HTMLTextAreaElement>;

  modulesdiv: React.RefObject<HTMLDivElement>;

  constructor(props: AboutWinProps) {
    super(props);

    const argState = windowArgument(
      'aboutWinState'
    ) as Partial<AboutWinState> | null;

    const s: AboutWinState = {
      ...initialState,
      ...(argState || {}),
    };
    // When no modules are specified, show them all.
    if (!s.modules.length) {
      s.modules = G.Tabs.map((t) => t.module);
    }
    this.state = s;

    this.textarea = React.createRef();
    this.modulesdiv = React.createRef();

    this.checkFocus = this.checkFocus.bind(this);
    this.handler = this.handler.bind(this);
  }

  componentDidMount() {
    this.checkFocus();
  }

  componentDidUpdate() {
    this.checkFocus();
  }

  handler(e: React.SyntheticEvent) {
    switch (e.type) {
      case 'click': {
        const state = this.state as AboutWinState;
        const { modules } = state;
        const target = e.currentTarget as HTMLElement;
        const [id, m] = target.id.split('.');
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
          case 'more': {
            const s: Partial<AboutWinState> = {
              showConf: modules.indexOf(m),
              editConf: false,
            };
            this.setState(s);
            break;
          }
          case 'less': {
            const s: Partial<AboutWinState> = {
              showConf: -1,
              editConf: false,
            };
            this.setState(s);
            break;
          }
          case 'edit': {
            const s: Partial<AboutWinState> = {
              editConf: true,
            };
            this.setState(s);
            break;
          }
          case 'save': {
            if (m && m in G.Tab) {
              const { textarea } = this;
              if (textarea?.current?.value) {
                G.Module.writeConf(G.Tab[m].confPath, textarea?.current?.value);
                const s: Partial<AboutWinState> = {
                  editConf: false,
                };
                this.setState(s);
              }
            }
            break;
          }
          case 'top': {
            const { modulesdiv } = this;
            if (modulesdiv.current) {
              modulesdiv.current.scrollTop = 0;
            }
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

  checkFocus() {
    const state = this.state as AboutWinState;
    const { modules, focusModule } = state;
    if (modules.length && focusModule !== -1 && modules[focusModule]) {
      const me = document.getElementById(`mod_${modules[focusModule]}`);
      if (me) {
        me.scrollIntoView();
        this.setState({ focusModule: -1 });
      }
    }
  }

  render() {
    const state = this.state as AboutWinState;
    const { modules, showModules, showContributors, showConf, editConf } =
      state;
    const { handler, textarea, modulesdiv } = this;

    const contributors: string[] =
      (G.Prefs.getComplexValue('Contributors') as string[]) || [];

    const { confPath } = (showConf !== -1 && G.Tab[modules[showConf]]) || {
      confPath: '',
    };
    const conftext: string[] =
      showConf === -1 || !confPath
        ? []
        : G.inlineFile(confPath, 'utf8', true).split('\n');

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
          <div className="modules" ref={modulesdiv}>
            {modules.length > 4 &&
              ['Texts', 'Comms', 'Dicts', 'Genbks'].map((t) => (
                <div key={`lt${t}`} className="linklist">
                  {modules.some((m) => G.Tab[m].tabType === t) && (
                    <>
                      <div className="head1">{i18n.t(t)}</div>
                      <div className="listbox">
                        <ul>
                          {modules
                            ?.sort((a, b) =>
                              G.Tab[a].label.localeCompare(G.Tab[b].label)
                            )
                            .map((m) =>
                              G.Tab[m].tabType === t ? (
                                <li key={`lm${m}`}>
                                  <a href={`#mod_${m}`} className={`cs-${m}`}>
                                    {G.Tab[m].label}
                                  </a>
                                </li>
                              ) : null
                            )}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              ))}
            {modules?.map((m, i) => (
              <div id={`mod_${m}`} className="modlist" key={`ml${m}`}>
                <div className="head1">
                  <span className={`cs-${m}`}>{G.Tab[m].label}</span>{' '}
                  <a href="#" id={`top.${m}`} onClick={handler}>
                    ↑
                  </a>
                </div>
                <div
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHTML(moduleInfoHTML([G.SwordConf[m]])),
                  }}
                />
                <div>
                  {(showConf === -1 || modules[showConf] !== m) && (
                    <>
                      <Button id={`more.${m}`} onClick={handler}>
                        {i18n.t('more.label')}
                      </Button>
                    </>
                  )}
                  {showConf !== -1 && modules[showConf] === m && (
                    <>
                      <Button id={`less.${m}`} onClick={handler}>
                        {i18n.t('less.label')}
                      </Button>
                      <Button id={`edit.${m}`} onClick={handler}>
                        {i18n.t('editMenu.label')}
                      </Button>
                      <Button
                        id={`save.${m}`}
                        disabled={!editConf}
                        onClick={handler}
                      >
                        {i18n.t('save.label')}
                      </Button>
                    </>
                  )}
                </div>
                {showConf !== -1 && modules[showConf] === m && (
                  <div>
                    <Label
                      className="confpath-label"
                      control={`ta.${m}`}
                      value={G.Tab[m].confPath}
                    />
                    <textarea
                      id={`ta.${m}`}
                      className={editConf ? 'editable' : 'readonly'}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      wrap="off"
                      readOnly={!editConf}
                      rows={conftext.length}
                      ref={textarea}
                    >
                      {conftext.join('\n')}
                    </textarea>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <Hbox className="dialogbuttons" pack="end" align="end">
          {modules.length && (
            <Button id="showModules" flex="1" fill="x" onClick={handler}>
              {showModules
                ? i18n.t('back.label')
                : i18n.t('chooseModule.label')}
            </Button>
          )}
          <Spacer flex="10" />
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

renderToRoot(<AboutWin />, null, null, { noResetOnResize: true });
