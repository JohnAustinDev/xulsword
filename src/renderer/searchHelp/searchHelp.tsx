/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, { useEffect } from 'react';
import i18n from 'i18next';
import { dString, sanitizeHTML } from '../../common';
import C from '../../constant';
import renderToRoot from '../rinit';
import { xulDefaultProps, xulPropTypes } from '../libxul/xul';
import './searchHelp.css';

// Search Help Window
const defaultProps = xulDefaultProps;
const propTypes = xulPropTypes;

function write(id: string, html: string): string {
  const elem = document.getElementById(id);
  if (elem) {
    elem.innerHTML = sanitizeHTML(html);
  }
  return '';
}

function SearchHelpWin() {
  // Write after mount, to allow use of HTML formatting and entities.
  useEffect(() => {
    write('searchTypes', i18n.t('searchTypes'));
    type.forEach((t, i) => {
      write(
        ['name', t].join('.'),
        `${dString(i + 1)}) ${i18n.t(`${t}.label`)}: `
      );
      write(['desc', t].join('.'), `${i18n.t(`${t}.description`)}`);
    });
    [...Array(4).keys()].forEach((c) => {
      [...Array(9).keys()].forEach((r) => {
        write(`row${r} col${c}`, celltext(r, c));
      });
    });
    write('caseMessage', i18n.t('searchCase'));
  });

  const type = [
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
  function celltext(row: number, col: number): string {
    if (col > 0 || row === 0) {
      return sanitizeHTML(i18n.t(`searchTable_${row}_${col}`));
    }
    const k = rows[row];
    if (k === null) return '';
    if (k.endsWith('START')) {
      let s = i18n.t(k);
      if (/^\s*$/.test(s)) [s] = C.UI.Search.symbol[k];
      let e = i18n.t(k.replace('START', 'END'));
      const ek = k.replace('START', 'END') as keyof typeof C.UI.Search.symbol;
      if (/^\s*$/.test(e)) [e] = C.UI.Search.symbol[ek];
      return `${s} ${e}`;
    }
    const t = i18n.t(k);
    return !/^\s*$/.test(t) ? t : C.UI.Search.symbol[k][0];
  }

  return (
    <div className="helpPane">
      <div id="searchTypes" />
      <div>
        {type.map((t, i) => (
          <div key={t}>
            <span id={['name', t].join('.')} className="typeName" />
            <span id={['desc', t].join('.')} className="typeDesc" />
          </div>
        ))}
      </div>
      <table>
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
      </table>
      <div id="caseMessage" />
    </div>
  );
}

SearchHelpWin.defaultProps = defaultProps;
SearchHelpWin.propTypes = propTypes;

renderToRoot(<SearchHelpWin height="100%" />);
