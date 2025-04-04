import React, { useLayoutEffect } from 'react';
import { sanitizeHTML } from '../../../common.ts';
import C from '../../../constant.ts';
import { GI } from '../../G.ts';
import { dString, functionalComponentRenderPromise } from '../../common.tsx';
import RenderPromise from '../../renderPromise.ts';
import {
  addClass,
  XulProps,
  xulPropTypes,
} from '../../components/libxul/xul.tsx';
import { Box } from '../libxul/boxes.tsx';
import './searchHelp.css';

import type { SearchType } from '../../../type.ts';

export type SearchHelpProps = {
  onlyLucene?: boolean;
} & XulProps;

function write(id: string, html: string) {
  const elem = document.getElementById(id);
  if (elem) elem.innerHTML = sanitizeHTML(html);
}

function getCellText(
  row: number,
  col: number,
  rows: Array<keyof typeof C.UI.Search.symbol | null>,
  renderPromise: RenderPromise,
): string {
  if (col > 0 || row === 0) {
    return sanitizeHTML(
      GI.i18n.t('', renderPromise, `searchTable_${row}_${col}`),
    );
  }
  const k = rows[row];
  if (k === null) return '';
  if (k.endsWith('START')) {
    let s = GI.i18n.t('', renderPromise, k);
    if (/^\s*$/.test(s)) [s] = C.UI.Search.symbol[k];
    let e = GI.i18n.t('', renderPromise, k.replace('START', 'END'));
    const ek = k.replace('START', 'END') as keyof typeof C.UI.Search.symbol;
    if (/^\s*$/.test(e)) [e] = C.UI.Search.symbol[ek];
    return `${s} ${e}`;
  }
  const t = GI.i18n.t('', renderPromise, k);
  return !/^\s*$/.test(t) ? t : C.UI.Search.symbol[k][0];
}

export default function SearchHelp(props: SearchHelpProps) {
  const { renderPromise, loadingRef } = functionalComponentRenderPromise();

  const type: Array<SearchType['type']> = [
    'SearchAnyWord',
    'SearchExactText',
    'SearchAdvanced',
    'SearchSimilar',
  ];

  const rows: Array<keyof typeof C.UI.Search.symbol | null> = [
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
    const { onlyLucene } = props;
    write('searchTypes', GI.i18n.t('', renderPromise, 'searchTypes'));
    type
      .filter((st) => !(onlyLucene && st === 'SearchExactText'))
      .forEach((t, i) => {
        write(
          ['name', t].join('.'),
          `${dString(i + 1)}) ${GI.i18n.t('', renderPromise, `${t}.label`)}: `,
        );
        write(
          ['desc', t].join('.'),
          `${GI.i18n.t('', renderPromise, `${t}.description`)}`,
        );
      });
    [...Array(4).keys()].forEach((c) => {
      [...Array(9).keys()].forEach((r) => {
        write(`row${r} col${c}`, getCellText(r, c, rows, renderPromise));
      });
    });
    write('caseMessage', GI.i18n.t('', renderPromise, 'searchCase'));
  });

  return (
    <Box domref={loadingRef} {...addClass('searchHelp', props)}>
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
        <div className="helpTable">
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
        </div>
        <div id="caseMessage" />
      </div>
    </Box>
  );
}
SearchHelp.propTypes = xulPropTypes;
