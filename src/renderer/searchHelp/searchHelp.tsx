/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useLayoutEffect } from 'react';
import { dString, sanitizeHTML } from '../../common.ts';
import C from '../../constant.ts';
import G from '../rg.ts';
import renderToRoot from '../renderer';
import { xulDefaultProps, xulPropTypes } from '../libxul/xul.tsx';
import './searchHelp.css';

import type { SearchType } from '../../type.ts';

function write(id: string, html: string) {
  const elem = document.getElementById(id);
  if (elem) elem.innerHTML = sanitizeHTML(html);
}

function getCellText(
  row: number,
  col: number,
  rows: (keyof typeof C.UI.Search.symbol | null)[]
): string {
  if (col > 0 || row === 0) {
    return sanitizeHTML(G.i18n.t(`searchTable_${row}_${col}`));
  }
  const k = rows[row];
  if (k === null) return '';
  if (k.endsWith('START')) {
    let s = G.i18n.t(k);
    if (/^\s*$/.test(s)) [s] = C.UI.Search.symbol[k];
    let e = G.i18n.t(k.replace('START', 'END'));
    const ek = k.replace('START', 'END') as keyof typeof C.UI.Search.symbol;
    if (/^\s*$/.test(e)) [e] = C.UI.Search.symbol[ek];
    return `${s} ${e}`;
  }
  const t = G.i18n.t(k);
  return !/^\s*$/.test(t) ? t : C.UI.Search.symbol[k][0];
}

function SearchHelpWin() {
  const type: SearchType['type'][] = [
    'SearchAnyWord',
    'SearchExactText',
    'SearchAdvanced',
    'SearchSimilar',
  ];

  const rows: (keyof typeof C.UI.Search.symbol | null)[] = [
    null,
    'MULTICharWildCard',
    'SINGLECharWildCard',
    'AND',
    'OR',
    'NOT',
    'GROUPSTART',
    'SIMILAR',
    'QUOTESTART',
  ];

  // Write after render, to allow use of HTML formatting and entities.
  useLayoutEffect(() => {
    write('searchTypes', G.i18n.t('searchTypes'));
    type.forEach((t, i) => {
      write(
        ['name', t].join('.'),
        `${dString(G.i18n, i + 1)}) ${G.i18n.t(`${t}.label`)}: `
      );
      write(['desc', t].join('.'), `${G.i18n.t(`${t}.description`)}`);
    });
    [...Array(4).keys()].forEach((c) => {
      [...Array(9).keys()].forEach((r) => {
        write(`row${r} col${c}`, getCellText(r, c, rows));
      });
    });
    write('caseMessage', G.i18n.t('searchCase'));
  }, []);

  return (
    <div className="helpPane">
      <div id="searchTypes" />
      <div>
        {type.map((t) => (
          <div key={t}>
            <span id={['name', t].join('.')} className="typeName" />
            <span id={['desc', t].join('.')} className="typeDesc" />
          </div>
        ))}
      </div>
      <table>
        <tbody>
          {[...Array(9).keys()].map((row) => (
            <tr
              key={`row${row}`}
              className={row % 2 === 1 ? 'odd-row' : 'even-row'}
            >
              {[...Array(4).keys()].map((col) => (
                <td
                  key={`row${row} col${col}`}
                  id={`row${row} col${col}`}
                  className={`row${row} col${col}`}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div id="caseMessage" />
    </div>
  );
}

SearchHelpWin.defaultProps = xulDefaultProps;
SearchHelpWin.propTypes = xulPropTypes;

renderToRoot(<SearchHelpWin height="100%" />);
