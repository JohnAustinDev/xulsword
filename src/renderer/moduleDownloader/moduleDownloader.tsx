/* eslint-disable class-methods-use-this */
/* eslint-disable react/sort-comp */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import i18n from 'i18next';
import { Button, IToastProps, Position, Toaster } from '@blueprintjs/core';
import {
  diff,
  downloadKey,
  drop,
  isRepoLocal,
  regionsToRows,
  rowToDownload,
} from '../../common';
import log from '../log';
import G from '../rg';
import renderToRoot from '../rinit';
import { getStatePref, onSetWindowState } from '../rutil';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import { Hbox, Vbox, Box } from '../libxul/boxes';
import Groupbox from '../libxul/groupbox';
import Spacer from '../libxul/spacer';
import DragSizer from '../libxul/dragsizer';
import RepositoryTable from './repositoryTable';
import handlerH from './moduleDownloaderH';
import './moduleDownloader.css';

import type { Download, DownloaderStatePref, SwordConfType } from '../../type';
import type { RepoDataType } from './repositoryTable';

export type ModuleRawDataType = (string | SwordConfType[])[];

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

export type DownloaderProps = XulProps;

// The following initial state values do not come from Prefs. Neither are
// these state keys written to Prefs.
const notStatePref = {
  module: null as string[] | null,
  showModuleInfo: false,
  downloading: false,

  repoTableData: [] as RepoDataType[],
  selectedRepos: undefined as { rows: [number, number] }[] | undefined,
  renderRepoTable: 0,
};

// Save table data between resets, but don't save it to prefs.
let RepoTableData: RepoDataType[] = [];
let RawModuleData: ModuleRawDataType | null = null;

export type DownloaderState = DownloaderStatePref & typeof notStatePref;

export default class ModuleDownloader extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  destroy: (() => void)[];

  handler: (e: React.SyntheticEvent) => void;

  toaster: Toaster | undefined;

  repositoryTableContainerRef: React.RefObject<HTMLDivElement>;

  constructor(props: DownloaderProps) {
    super(props);

    if (props.id !== 'downloader') throw Error(`ID must be 'downloader'`);
    const s: DownloaderState = {
      ...notStatePref,
      ...(getStatePref(props.id) as DownloaderStatePref),
      repoTableData: RepoTableData,
    };
    this.state = s;

    this.repositoryTableContainerRef = React.createRef();

    this.destroy = [];
    this.handler = handlerH.bind(this);
    this.onCellEdited = this.onCellEdited.bind(this);
    this.onColumnWidthChanged = this.onColumnWidthChanged.bind(this);
    this.loadRepos = this.loadRepos.bind(this);
    this.repoDataReady = this.repoDataReady.bind(this);
    this.loadModuleTable = this.loadModuleTable.bind(this);
    this.sizeRepoTableToWindow = this.sizeRepoTableToWindow.bind(this);
    this.setRepoTableState = this.setRepoTableState.bind(this);
  }

  componentDidMount() {
    // Download data for the repository and module tables
    if (!RepoTableData.length) {
      RepoTableData = [];
      RawModuleData = [];
      G.Downloader.crossWireMasterRepoList()
        .then(this.loadRepos)
        .then(this.repoDataReady)
        .then(this.loadModuleTable)
        .catch(() => {
          this.addToast({
            message: 'Unable to download Master Repository List.',
          });
          // Failed to load master list, so just load local repos.
          RepoTableData = [];
          RawModuleData = [];
          // eslint-disable-next-line promise/no-nesting
          this.loadRepos()
            .then(this.repoDataReady)
            .then(this.loadModuleTable)
            .catch((err) => log.warn(err));
        });
    }
    this.sizeRepoTableToWindow();
    this.destroy.push(onSetWindowState(this));
    // Setup progress handlers
    this.destroy.push(
      window.ipc.renderer.on('progress', (prog: number, id?: string) => {
        const { repoTableData } = this.state as DownloaderState;
        const repoIndex = repoTableData.findIndex(
          (i) => downloadKey(rowToDownload(i)) === id
        );
        if (id && repoIndex !== -1 && prog === -1) {
          repoTableData[repoIndex][4].off = false;
          repoTableData[repoIndex][3] = RepositoryTable.on;
          this.setRepoTableState({ repoTableData });
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
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  sizeRepoTableToWindow() {
    // Size tables to window
    const state = this.state as DownloaderState;
    const { repositoryTableContainerRef } = this;
    if (repositoryTableContainerRef.current) {
      const table =
        repositoryTableContainerRef.current as HTMLDivElement | null;
      if (table) {
        const w = table.clientWidth;
        const t = state.repoColumnWidths.reduce((p, c) => p + c, 0);
        const repoColumnWidths = state.repoColumnWidths.map((cw) => {
          return w * (cw / t);
        });
        this.setRepoTableState({
          repoColumnWidths,
        });
      }
    }
  }

  onCellEdited(row: number, col: number, value: string) {
    this.setState((prevState: DownloaderState) => {
      const { repoTableData } = prevState;
      repoTableData[row][col] = value;
      return { repoTableData };
    });
  }

  onColumnWidthChanged(index: number, size: number): void {
    const state = this.state as DownloaderState;
    const repoColumnWidths = state.repoColumnWidths.slice();
    repoColumnWidths[index] = size;
    this.setRepoTableState({
      repoColumnWidths,
    });
    this.sizeRepoTableToWindow();
  }

  async loadRepos(repos?: Download[]) {
    const { customRepos, disabledRepos } = this.state as DownloaderState;
    const repoTableData: RepoDataType[] = [];
    const allrepos = customRepos.concat(repos || []);
    allrepos.forEach((repo, i) => {
      const disabled = disabledRepos.includes(downloadKey(repo));
      repo.disabled = disabled;
      const loading = isRepoLocal(repo)
        ? RepositoryTable.on
        : RepositoryTable.loading;
      repoTableData.push([
        repo.name || '',
        repo.domain,
        repo.path,
        disabled ? RepositoryTable.off : loading,
        { custom: i < customRepos.length, off: disabled, failed: false },
      ]);
    });
    this.setRepoTableState({ repoTableData });
    return G.Downloader.repositoryListing(allrepos);
  }

  // Apply new raw repository listing data to state. If rows is undefined, a
  // complete listing including every row must be supplied, otherwise, the
  // rawModuleData need only contain data for the given row(s).
  repoDataReady(rawModuleData: (string | SwordConfType[])[], rows?: boolean[]) {
    const { repoTableData } = this.state as DownloaderState;
    if (!rows) RawModuleData = rawModuleData;
    if (RawModuleData) {
      RawModuleData.forEach((repoin, i) => {
        if (rows && !rows[i]) return;
        let repo = repoin;
        if (rows) {
          const rpo = rawModuleData.shift();
          if (rpo) repo = rpo;
        }
        if (!repoTableData[i][4].off) {
          repoTableData[i][4].failed = false;
          if (typeof repo === 'string') {
            if (!isRepoLocal(repoTableData[i])) {
              repoTableData[i][4].failed = true;
            }
            if (repo) {
              this.addToast({ message: repo });
            }
          }
          repoTableData[i][4].off = false;
          repoTableData[i][3] = RepositoryTable.on;
        }
      });
      this.setRepoTableState({ repoTableData });
    }
    return true;
  }

  setRepoTableState(s: Partial<DownloaderState>) {
    // Two steps must be used for statePrefs to be written to Prefs
    // before the reset will read them.
    this.setState(s);
    this.setState((prevState: DownloaderState) => {
      let { renderRepoTable } = prevState;
      RepoTableData = prevState.repoTableData;
      renderRepoTable += 1;
      return {
        renderRepoTable,
      } as DownloaderState;
    });
  }

  loadModuleTable() {
    return true;
  }

  refHandlers = {
    toaster: (ref: Toaster) => {
      this.toaster = ref;
    },
  };

  addToast(toast: IToastProps) {
    toast.timeout = 5000;
    toast.intent = 'warning';
    if (this.toaster) this.toaster.show(toast);
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
      repoColumnWidths,
      repoTableData,
      selectedRepos,
      renderRepoTable,
    } = state;
    const {
      handler,
      onCellEdited,
      onColumnWidthChanged,
      repositoryTableContainerRef,
    } = this;

    const loading = repoTableData.map((r) => r[3] === RepositoryTable.loading);

    const disable = {
      download: !module,
      moduleInfo: !module,
      moduleInfoBack: false,
      moduleCancel: !downloading,
      repoAdd: false,
      repoDelete:
        !selectedRepos ||
        !regionsToRows(selectedRepos).every(
          (r) => repoTableData[r] && repoTableData[r][4].custom
        ),
      repoCancel: !loading.find((l) => l),
    };

    return (
      <Vbox flex="1" height="100%">
        <Toaster
          canEscapeKeyClear
          position={Position.TOP}
          usePortal
          ref={this.refHandlers.toaster}
        />
        <Hbox className="language-pane" flex="1">
          {languageListOpen && (
            <>
              <Groupbox
                caption={i18n.t('menu.options.language')}
                orient="vertical"
                width={languageListPanelWidth}
              >
                <Box flex="1" />
                <Button
                  id="languageListClose"
                  icon="chevron-left"
                  fill
                  onClick={() => this.setState({ languageListOpen: false })}
                />
              </Groupbox>
              <DragSizer
                onDragStart={() => state.languageListPanelWidth}
                onDrag={(w: number) =>
                  this.setState({ languageListPanelWidth: w })
                }
                orient="vertical"
              />
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
            <Vbox className="button-stack" pack="center">
              <Button
                id="download"
                icon="download"
                intent="primary"
                disabled={disable.download}
                onClick={handler}
              />
              {!showModuleInfo && (
                <Button
                  id="moduleInfo"
                  icon="info-sign"
                  intent="primary"
                  disabled={disable.moduleInfo}
                  onClick={handler}
                />
              )}
              {showModuleInfo && (
                <Button
                  id="moduleInfoBack"
                  intent="primary"
                  disabled={disable.moduleInfoBack}
                  onClick={handler}
                >
                  {i18n.t('back.label')}
                </Button>
              )}
              <Button
                id="moduleCancel"
                intent="primary"
                disabled={disable.moduleCancel}
                onClick={handler}
              >
                {i18n.t('cancel.label')}
              </Button>
            </Vbox>
          </Groupbox>
        </Hbox>

        {repoListOpen && (
          <>
            <DragSizer
              onDragStart={() => state.repoListPanelHeight}
              onDrag={(h: number) => this.setState({ repoListPanelHeight: h })}
              orient="horizontal"
              shrink
            />
            <Groupbox
              caption={i18n.t('moduleSources.label')}
              height={repoListPanelHeight}
              orient="horizontal"
              flex="1"
            >
              <Box
                className="repositoryTableCont"
                flex="1"
                domref={repositoryTableContainerRef}
                onClick={handler}
              >
                {!!repoTableData.length && (
                  <RepositoryTable
                    key={renderRepoTable}
                    data={repoTableData}
                    loading={loading}
                    selectedRegions={selectedRepos}
                    columnWidths={repoColumnWidths}
                    onColumnWidthChanged={onColumnWidthChanged}
                    onCellChange={onCellEdited}
                  />
                )}
              </Box>
              <Vbox className="button-stack" pack="center">
                <Button
                  id="repoAdd"
                  icon="add"
                  intent="primary"
                  disabled={disable.repoAdd}
                  onClick={handler}
                />
                <Button
                  id="repoDelete"
                  icon="delete"
                  intent="primary"
                  disabled={disable.repoDelete}
                  onClick={handler}
                />
                <Button
                  id="repoCancel"
                  intent="primary"
                  disabled={disable.repoCancel}
                  onClick={handler}
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
