/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import i18n from 'i18next';
import { Button } from '@blueprintjs/core';
import log from '../log';
import G from '../rg';
import renderToRoot from '../rinit';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import { Hbox, Vbox, Box } from '../libxul/boxes';
import Groupbox from '../libxul/groupbox';
import Spacer from '../libxul/spacer';
import handlerH from './moduleDownloaderH';
import './moduleDownloader.css';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

type ModuleDownloaderProps = XulProps;

type ModuleDownloaderState = {
  language: string | null;
  module: string[] | null;
  moduleSource: string[] | null;

  showModuleInfo: boolean;
  downloading: boolean;
  polling: boolean;

  languageListOpen: boolean;
  languageListPanelWidth: number;
  moduleSourceOpen: boolean;
  moduleSourcePanelHeight: number;
};

// This is global so repositories are only loaded once, when the window opens.
let RepositoriesDownloaded = false;

export default class ModuleDownloader extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  destroy: (() => void)[];

  handler: (e: React.SyntheticEvent) => void;

  constructor(props: ModuleDownloaderProps) {
    super(props);

    const s: ModuleDownloaderState = {
      language: null,
      module: null,
      moduleSource: null,

      showModuleInfo: false,
      downloading: false,
      polling: false,

      languageListOpen: true,
      languageListPanelWidth: 180,
      moduleSourceOpen: true,
      moduleSourcePanelHeight: 350,
    };
    this.state = s;

    this.destroy = [];
    this.handler = handlerH.bind(this);
  }

  componentDidMount() {
    if (!RepositoriesDownloaded) {
      RepositoriesDownloaded = false;
      G.Downloader.crossWireMasterRepoList()
        .then((repos) => {
          // TODO!: update repo table
          console.log(repos);
          return G.Downloader.repositoryListing(repos);
        })
        .then((confs) => {
          // TODO!: update module table
          console.log(confs);
          return true;
        })
        .catch((er) => log.warn(er));
    }
    this.destroy.push(
      window.ipc.renderer.on('progress', (prog: number, id?: string) => {
        if (id) {
          // TODO!: show progress in repo table
          console.log(`${id}: ${prog}`);
        }
      })
    );
  }

  componentWillUnmount() {
    // clearPending(this, ['historyTO', 'dictkeydownTO', 'wheelScrollTO']);
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  render() {
    const state = this.state as ModuleDownloaderState;
    const {
      language,
      module,
      moduleSource,
      downloading,
      polling,
      languageListOpen,
      languageListPanelWidth,
      showModuleInfo,
      moduleSourceOpen,
      moduleSourcePanelHeight,
    } = state;
    const { handler } = this;

    const disable = {
      download: !module,
      moduleInfo: !module,
      moduleInfoBack: false,
      cancel: !downloading,
      repoToggle: !moduleSource,
      repoAdd: false,
      repoDelete: !moduleSource,
      repoCancel: !polling,
    };
    return (
      <Vbox flex="1" height="100%">
        <Hbox className="language-pane" flex="1">
          {languageListOpen && (
            <>
              <Groupbox
                caption={i18n.t('menu.options.language')}
                orient="vertical"
                width={`${languageListPanelWidth}`}
              >
                <Box flex="1" />
                <Button
                  id="languageListClose"
                  icon="chevron-left"
                  fill
                  onClick={() => this.setState({ languageListOpen: false })}
                />
              </Groupbox>
              <Spacer id="languageListSizer" width="10" />
            </>
          )}
          {!languageListOpen && (
            <Groupbox orient="vertical">
              <Vbox flex="1">
                <Button
                  id="languageListOpen"
                  icon="chevron-right"
                  style={{ height: '100%' }}
                  onClick={() => this.setState({ languageListOpen: true })}
                />
              </Vbox>
            </Groupbox>
          )}

          <Groupbox
            caption={i18n.t('menu.addNewModule.label')}
            orient="horizontal"
            flex="1"
          >
            <Hbox flex="1">
              {showModuleInfo && <div id="moduleInfo">Module Information</div>}
              {!showModuleInfo && <Box>Module Table</Box>}
            </Hbox>
            <Vbox className="button-stack" pack="center" onClick={handler}>
              <Button
                id="download"
                icon="download"
                intent="primary"
                disabled={disable.download}
              />
              {!showModuleInfo && (
                <Button
                  id="moduleInfo"
                  icon="info-sign"
                  intent="primary"
                  disabled={disable.moduleInfo}
                />
              )}
              {showModuleInfo && (
                <Button
                  id="moduleInfoBack"
                  intent="primary"
                  disabled={disable.moduleInfoBack}
                >
                  {i18n.t('back.label')}
                </Button>
              )}
              <Button id="cancel" intent="primary" disabled={disable.cancel}>
                {i18n.t('cancel.label')}
              </Button>
            </Vbox>
          </Groupbox>
        </Hbox>

        {moduleSourceOpen && (
          <>
            <Spacer id="moduleSourceSizer" width="10" />
            <Groupbox
              caption={i18n.t('moduleSources.label')}
              height={`${moduleSourcePanelHeight}`}
              orient="horizontal"
              flex="1"
            >
              <Box flex="1" />
              <Vbox className="button-stack" pack="center" onClick={handler}>
                <Button
                  id="repoToggle"
                  icon="tick"
                  intent="primary"
                  disabled={disable.repoToggle}
                />
                <Button
                  id="repoAdd"
                  icon="add"
                  intent="primary"
                  disabled={disable.repoAdd}
                />
                <Button
                  id="repoDelete"
                  icon="delete"
                  intent="primary"
                  disabled={disable.repoDelete}
                />
                <Button
                  id="repoCancel"
                  intent="primary"
                  disabled={disable.repoCancel}
                >
                  {i18n.t('cancel.label')}
                </Button>
              </Vbox>
            </Groupbox>
          </>
        )}

        <Hbox className="dialogbuttons" pack="end" align="end">
          {moduleSourceOpen && (
            <Button onClick={() => this.setState({ moduleSourceOpen: false })}>
              {i18n.t('less.label')}
            </Button>
          )}
          {!moduleSourceOpen && (
            <Button onClick={() => this.setState({ moduleSourceOpen: true })}>
              {i18n.t('moduleSources.label')}
            </Button>
          )}
          <Spacer flex="1" />
          <Button id="cancel" onClick={handler}>
            {i18n.t('cancel.label')}
          </Button>
          <Button id="ok" onClick={handler}>
            {i18n.t('ok.label')}
          </Button>
        </Hbox>
      </Vbox>
    );
  }
}
ModuleDownloader.defaultProps = defaultProps;
ModuleDownloader.propTypes = propTypes;

renderToRoot(<ModuleDownloader />);
