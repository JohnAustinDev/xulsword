/* eslint-disable no-nested-ternary */
/* eslint-disable import/no-duplicates */
import { SyntheticEvent } from 'react';
import C from '../../constant';
import G from '../rg';
import log from '../log';
import {
  clone,
  downloadKey,
  isRepoLocal,
  ofClass,
  regionsToRows,
  rowToDownload,
} from '../../common';
import RepositoryTable, { RepoDataType } from './repositoryTable';

import type { Download } from '../../type';
import type ModuleDownloader from './moduleDownloader';
import type { DownloaderState } from './moduleDownloader';

function toggleRepo(mdcomponent: ModuleDownloader, rows: number[]) {
  const { disabledRepos: dr, repoTableData } =
    mdcomponent.state as DownloaderState;
  const newTableData = clone(repoTableData);
  const disabledRepos = dr.slice();
  const reload: boolean[] = repoTableData.map(() => false);
  rows.forEach((r) => {
    const rowkey = downloadKey(rowToDownload(repoTableData[r]));
    const isLocal = isRepoLocal(repoTableData[r]);
    const disabledIndex = disabledRepos.findIndex((drs) => {
      return drs === rowkey;
    });
    if (repoTableData[r][4].off) {
      newTableData[r][4].off = false;
      if (disabledIndex !== -1) disabledRepos.splice(disabledIndex, 1);
      const onOrLoading = !isLocal
        ? RepositoryTable.loading
        : RepositoryTable.on;
      newTableData[r][3] = onOrLoading;
      reload[r] = onOrLoading === RepositoryTable.loading;
    } else {
      if (!isLocal && newTableData[r][3] === RepositoryTable.loading) {
        G.Downloader.ftpCancel();
      }
      newTableData[r][4].off = true;
      if (disabledIndex === -1) disabledRepos.push(rowkey);
      newTableData[r][3] = RepositoryTable.off;
    }
  });
  mdcomponent.setRepoTableState({
    repoTableData: newTableData,
    disabledRepos,
  });
  if (reload.some((r) => r)) {
    G.Downloader.repositoryListing(
      reload
        .map((rl, i) => {
          if (!rl) return null;
          return rowToDownload(newTableData[i]);
        })
        .filter(Boolean) as Download[]
    )
      .then((rawModuleData) => {
        if (!rawModuleData) return false;
        return mdcomponent.repoDataReady(rawModuleData, reload);
      })
      .catch((er) => log.warn(er));
  }
}

export default function handler(this: ModuleDownloader, ev: SyntheticEvent) {
  switch (ev.type) {
    case 'click': {
      const e = ev as React.MouseEvent;
      switch (e.currentTarget.id) {
        case 'cancel': {
          G.Window.close();
          break;
        }
        case 'ok': {
          // TODO!: Install modules
          G.Commands.installXulswordModules([]);
          G.Window.close();
          break;
        }
        case 'repoAdd': {
          const state = this.state as DownloaderState;
          const { customRepos: cr, repoTableData } = state as DownloaderState;
          const customRepos = clone(cr);
          const newrow: RepoDataType = [
            '?',
            C.Downloader.localDomain,
            '?',
            RepositoryTable.off,
            { custom: true, off: true, failed: false },
          ];
          repoTableData.unshift(newrow);
          customRepos.push(rowToDownload(newrow));
          this.setRepoTableState({
            customRepos,
            repoTableData,
          });
          // TODO! Update module table data
          break;
        }
        case 'repoDelete': {
          const { customRepos, repoTableData, selectedRepos } = this
            .state as DownloaderState;
          const newTableData = clone(repoTableData);
          const newCustomRepos = clone(customRepos);
          const rows = (selectedRepos && regionsToRows(selectedRepos)) || [];
          if (rows.length) {
            rows.reverse().forEach((r) => {
              if (repoTableData[r][4].custom) {
                newTableData.splice(r, 1);
                const crIndex = customRepos.findIndex(
                  (ro) =>
                    downloadKey(ro) ===
                    downloadKey(rowToDownload(repoTableData[r]))
                );
                if (crIndex !== -1) {
                  newCustomRepos.splice(crIndex, 1);
                }
              }
            });
            this.setRepoTableState({
              customRepos: newCustomRepos,
              repoTableData: newTableData,
            });
            // TODO: Update module table data
          }
          break;
        }
        case 'repoCancel': {
          G.Downloader.ftpCancel();
          break;
        }
        default:
      }
      // Handle table clicks
      const cell = ofClass(['bp4-table-cell'], e.target);
      if (cell) {
        const rowm = cell.element.className.match(/bp4-table-cell-row-(\d+)\b/);
        const row = rowm ? Number(rowm[1]) : -1;
        const colm = cell.element.className.match(/bp4-table-cell-col-(\d+)\b/);
        const col = colm ? Number(colm[1]) : -1;
        if (row > -1 && col < 3) {
          // Change selection
          this.setState((prevState: DownloaderState) => {
            const isSelected = prevState.selectedRepos?.find(
              (r) => r.rows[0] === row
            );
            const selectedRepos =
              e.ctrlKey && !isSelected && prevState.selectedRepos
                ? clone(prevState.selectedRepos)
                : [];
            if (!isSelected) selectedRepos.push({ rows: [row, row] });
            return { selectedRepos } as DownloaderState;
          });
        }
        if (row > -1 && col === 3) {
          // Click checkbox
          toggleRepo(this, [row]);
        }
      }
      break;
    }
    default:
      throw Error(`Unhandled moddown event type ${ev.type}`);
  }
}
