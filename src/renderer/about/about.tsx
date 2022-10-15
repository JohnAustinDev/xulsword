/* eslint-disable react/static-property-placement */
import React from 'react';
import i18n from 'i18next';
import G from '../rg';
import renderToRoot from '../rinit';
import { windowArgument } from '../rutil';
import { Hbox, Vbox } from '../libxul/boxes';
import Label from '../libxul/label';
import Stack from '../libxul/stack';
import Button from '../libxul/button';
import Spacer from '../libxul/spacer';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import '../splash/splash.css';
import './about.css';

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

type AboutWinProps = XulProps;

const startingState = {
  modules: [] as string[],
  edit: null as number | null,
  showModules: false as boolean,
  showContributors: false as boolean,
};

type AboutWinState = typeof startingState;

export default class AboutWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: AboutWinProps) {
    super(props);

    const ms = windowArgument('modules') as { modules: string[] } | null;
    const modules =
      (ms?.modules?.length && ms.modules) || G.Tabs.map((t) => t.module);

    const s: AboutWinState = {
      ...startingState,
      ...(modules && modules.length ? { modules } : {}),
    };
    this.state = s;

    this.handler = this.handler.bind(this);
  }

  handler = (e: React.SyntheticEvent) => {
    switch (e.type) {
      case 'click': {
        const target = e.currentTarget as HTMLElement;
        switch (target.id) {
          case 'showModules':
          case 'showContributors': {
            this.setState((prevState: AboutWinState) => {
              const p = target.id as 'showModules' | 'showContributors';
              return { [p]: !prevState[p] };
            });
            break;
          }
          case 'close': {
            G.Window.close();
            break;
          }
          default:
        }
        break;
      }
      default:
    }
  };

  render() {
    const state = this.state as AboutWinState;
    const { modules, showModules, showContributors } = state;
    const { handler } = this;

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
                      value={i18n.t('producedBy')}
                    />
                  </Vbox>
                </Hbox>
              </Vbox>
              {showContributors && (
                <Vbox id="layer3" flex="1">
                  Contributors
                </Vbox>
              )}
            </Stack>
            <Spacer orient="vertical" flex="1" />
          </Hbox>
        )}
        {showModules && (
          <Vbox className="modules">
            {modules?.map((m) => (
              <div key={m}>{m}</div>
            ))}
          </Vbox>
        )}
        <Hbox className="dialogbuttons" pack="end" align="end">
          <Button id="showModules" flex="1" fill="x" onClick={handler}>
            {showModules ? i18n.t('back.label') : i18n.t('chooseModule.label')}
          </Button>
          <Spacer flex="10" />
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

renderToRoot(<AboutWin />);
