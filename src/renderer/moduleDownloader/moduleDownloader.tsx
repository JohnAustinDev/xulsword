/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import i18n from 'i18next';
import { Button } from '@blueprintjs/core';
import { clone, diff, drop } from '../../common';
import log from '../log';
import G from '../rg';
import renderToRoot from '../rinit';
import { getStatePref, onSetWindowState } from '../rutil';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import { Hbox, Vbox, Box } from '../libxul/boxes';
import Groupbox from '../libxul/groupbox';
import Spacer from '../libxul/spacer';
import RepositoryTable, { DataColumns } from './repositoryTable';
import handlerH from './moduleDownloaderH';
import './moduleDownloader.css';

import type { Download } from '../../type';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

export type DownloaderProps = XulProps;

type DownloaderStatePref = {
  language: string | null;
  languageListOpen: boolean;
  languageListPanelWidth: number;

  customRepos: Download[];
  repoListOpen: boolean;
  repoListPanelHeight: number;
};

// The following initial state values do not come from Prefs. Neither are
// these state keys written to Prefs.
const notStatePref = {
  module: null as string[] | null,
  showModuleInfo: false,
  downloading: false,

  repoTableData: DataColumns.map(() => []) as (string | number)[][],
  selectedRepos: undefined as { rows: [number, number] }[] | undefined,
};

// Save table data between resets, but don't save to prefs.
let RepoTableData = notStatePref.repoTableData;

export type DownloaderState = DownloaderStatePref & typeof notStatePref;

export default class ModuleDownloader extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  destroy: (() => void)[];

  handler: (e: React.SyntheticEvent) => void;

  constructor(props: DownloaderProps) {
    super(props);

    if (props.id !== 'downloader') throw Error(`ID must be 'downloader'`);
    const s: DownloaderState = {
      ...notStatePref,
      ...(getStatePref(props.id) as DownloaderStatePref),
      repoTableData: RepoTableData,
    };
    this.state = s;

    this.destroy = [];
    this.handler = handlerH.bind(this);
  }

  componentDidMount() {
    if (!RepoTableData[0].length) {
      this.getTableData()
        .then((data) => {
          RepoTableData = data;
          return true;
        })
        .catch((er) => log.warn(er));
    }
    this.destroy.push(onSetWindowState(this));
    this.destroy.push(
      window.ipc.renderer.on('progress', (prog: number, id?: string) => {
        const state = this.state as DownloaderState;
        const repoIndex = state.repoTableData.findIndex((i) => i[0] === id);
        if (id && repoIndex !== -1 && prog === -1) {
          this.setState((prevState: DownloaderState) => {
            const repoTableData = clone(prevState.repoTableData);
            repoTableData[repoIndex][3] = 'ready';
            return { repoTableData };
          });
        }
      })
    );
  }

  componentDidUpdate(_prevProps: any, prevState: DownloaderState) {
    const state = this.state as DownloaderState;
    const { id } = this.props as DownloaderProps;
    if (id) {
      const newStatePref = drop(state, notStatePref);
      const d = diff(drop(prevState, notStatePref), newStatePref);
      if (d) {
        G.Prefs.mergeValue(id, d);
      }
    }
  }

  componentWillUnmount() {
    // clearPending(this, ['historyTO', 'dictkeydownTO', 'wheelScrollTO']);
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  getTableData() {
    return G.Downloader.crossWireMasterRepoList()
      .then((repos) => {
        const { customRepos } = this.state as DownloaderState;
        const repoTableData: DownloaderState['repoTableData'] = [];
        customRepos.concat(repos).forEach((repo, i) => {
          repoTableData.push([
            repo.name || `unknown${i}`,
            repo.domain,
            repo.path,
            'loading',
          ]);
        });
        this.setState({ repoTableData } as DownloaderState);
        return G.Downloader.repositoryListing(repos);
      })
      .then((confs) => {
        const { repoTableData } = this.state as DownloaderState;
        confs.forEach((c, i) => {
          repoTableData[i][3] = typeof c === 'string' ? c : 'on';
        });
        this.setState({ repoTableData } as DownloaderState);
        return repoTableData;
      });
  }

  render() {
    const state = this.state as DownloaderState;
    const {
      language,
      languageListOpen,
      languageListPanelWidth,

      module,
      downloading,
      showModuleInfo,

      repoListOpen,
      repoListPanelHeight,
      repoTableData,
      selectedRepos,
    } = state;
    const { handler } = this;

    const loading = repoTableData.map((r) => r[3] === 'loading');

    const disable = {
      download: !module,
      moduleInfo: !module,
      moduleInfoBack: false,
      cancel: !downloading,
      repoToggle: !selectedRepos?.length,
      repoAdd: false,
      repoDelete: !selectedRepos?.length,
      repoCancel: !loading.find((l) => l),
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

        {repoListOpen && (
          <>
            <Spacer id="moduleSourceSizer" width="10" />
            <Groupbox
              caption={i18n.t('moduleSources.label')}
              height={`${repoListPanelHeight}`}
              orient="horizontal"
              flex="1"
            >
              <Box flex="1" onClick={handler}>
                <RepositoryTable
                  key={loading.join('.')}
                  data={repoTableData}
                  loading={loading}
                  selectedRegions={selectedRepos}
                />
              </Box>
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
          {repoListOpen && (
            <Button onClick={() => this.setState({ repoListOpen: false })}>
              {i18n.t('less.label')}
            </Button>
          )}
          {!repoListOpen && (
            <Button onClick={() => this.setState({ repoListOpen: true })}>
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

renderToRoot(<ModuleDownloader id="downloader" />);
