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
import RepositoryTable from './repositoryTable';

import type { Download } from '../../type';
import type ModuleDownloader from './moduleDownloader';
import type { DownloaderState } from './moduleDownloader';

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
        case 'repoToggle': {
          // TODO!: Multiple off, toggle one on, all come on!
          const { selectedRepos, repoTableData } = this
            .state as DownloaderState;
          const newTableData = clone(repoTableData);
          const reload: boolean[] = repoTableData.map(() => false);
          const selrows = (selectedRepos && regionsToRows(selectedRepos)) || [];
          selrows.forEach((r) => {
            const isLocal = isRepoLocal(repoTableData[r]);
            if (repoTableData[r][4].off) {
              newTableData[r][4].off = false;
              const onOrLoading = isLocal
                ? RepositoryTable.on
                : RepositoryTable.loading;
              newTableData[r][3] = onOrLoading;
              reload[r] = onOrLoading === RepositoryTable.loading;
            } else {
              if (!isLocal && newTableData[r][3] === RepositoryTable.loading) {
                G.Downloader.ftpCancel();
              }
              newTableData[r][4].off = true;
              newTableData[r][3] = RepositoryTable.off;
            }
          });
          this.setRepoTableState(newTableData);
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
                return this.repoDataReady(rawModuleData, reload);
              })
              .catch((er) => log.warn(er));
          }
          break;
        }
        case 'repoAdd': {
          const { repoTableData } = this.state as DownloaderState;
          repoTableData.unshift([
            '?',
            C.Downloader.localDomain,
            '?',
            RepositoryTable.off,
            { custom: true, off: true, failed: false },
          ]);
          this.setRepoTableState(repoTableData);
          // TODO! Update module table data
          break;
        }
        case 'repoDelete': {
          const { selectedRepos, repoTableData } = this
            .state as DownloaderState;
          const newrtd = clone(repoTableData);
          const rows = (selectedRepos && regionsToRows(selectedRepos)) || [];
          if (rows.length) {
            rows.reverse().forEach((r) => {
              if (repoTableData[r][4].custom) {
                newrtd.splice(r, 1);
              }
            });
            this.setRepoTableState(newrtd);
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
      // Row selection...
      const cell = ofClass(['bp4-table-cell'], e.target);
      if (cell) {
        const rowm = cell.element.className.match(/bp4-table-cell-row-(\d+)\b/);
        if (rowm) {
          const row = Number(rowm[1]);
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
      }
      break;
    }
    default:
      throw Error(`Unhandled moddown event type ${ev.type}`);
  }
}
