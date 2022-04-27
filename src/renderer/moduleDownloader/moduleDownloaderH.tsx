/* eslint-disable import/no-duplicates */
import { SyntheticEvent } from 'react';
import { clone, ofClass } from '../../common';

import type ModuleDownloader from './moduleDownloader';
import type { DownloaderState } from './moduleDownloader';

export default function handler(this: ModuleDownloader, ev: SyntheticEvent) {
  switch (ev.type) {
    case 'click': {
      const e = ev as React.MouseEvent;
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
            this.setState({ selectedRepos } as DownloaderState);
          });
        }
      }
      break;
    }
    default:
      throw Error(`Unhandled moddown event type ${ev.type}`);
  }
}
