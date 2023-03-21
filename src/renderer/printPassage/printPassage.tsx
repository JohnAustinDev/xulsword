/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React, { ReactElement } from 'react';
import ReactDOM from 'react-dom';
import { ProgressBar } from '@blueprintjs/core';
import Subscription from '../../subscription';
import { diff, sanitizeHTML, stringHash, querablePromise } from '../../common';
import S from '../../defaultPrefs';
import G from '../rg';
import renderToRoot from '../renderer';
import { windowArguments, getStatePref, setStatePref } from '../rutil';
import log from '../log';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import Grid, { Column, Columns, Row, Rows } from '../libxul/grid';
import Groupbox from '../libxul/groupbox';
import Checkbox from '../libxul/checkbox';
import { Hbox } from '../libxul/boxes';
import Button from '../libxul/button';
import Spacer from '../libxul/spacer';
import PrintSettings from '../libxul/printSettings';
import VKSelect from '../libxul/vkselect';
import {
  handler as handlerH,
  vkSelectHandler as vkSelectHandlerH,
  validPassage,
  bibleChapterText,
} from './printPassageH';
import '../libsword.css';
import '../viewport/atext.css';
import './printPassage.css';

import type { OSISBookType, QuerablePromise } from '../../type';

// TODO!: Dictlinks aren't implemented. CSS needs improvement. Print hasn't been checked.
// TODO!: As of 11/22 @page {@bottom-center {content: counter(page);}} does not work

// 0=none, 1=checkbox, 2=placeholder
const switches = [
  [
    [1, 1, 'headings', 'menu.view.headings'],
    [1, 1, 'footnotes', 'menu.view.footnotes'],
    [1, 1, 'usernotes', 'menu.view.usernotes'],
    [1, 1, 'crossrefs', 'menu.view.crossrefs'],
    [1, 1, 'crossrefsText', 'crossrefs.withText.label'],
    [0, 2, '' as never, ''],
  ],
  [
    [1, 1, 'introduction', 'introduction.label'],
    [1, 1, 'versenums', 'menu.view.versenums'],
    [1, 1, 'redwords', 'menu.view.redwords'],
    [1, 1, 'dictlinks', 'menu.view.dictlinks'],
    [2, 1, 'hebcantillation', 'menu.options.hebCant'],
    [0, 1, 'hebvowelpoints', 'menu.options.hebVowel'],
  ],
] as const;

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

type PrintPassageProps = XulProps;

const notStatePrefDefault = {
  showpage: 1 as number,
  progress: -1 as number,
};

let openedWinState = windowArguments(
  'passageWinState'
) as Partial<PrintPassageState> | null;

export type PrintPassageState = typeof S.prefs.printPassage &
  typeof notStatePrefDefault;

export default class PrintPassageWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  renderPromises: QuerablePromise<string>[];

  textdiv: React.RefObject<HTMLDivElement>;

  pagebuttons: React.RefObject<HTMLDivElement>;

  handler: typeof handlerH;

  vkSelectHandler: typeof vkSelectHandlerH;

  constructor(props: PrintPassageProps) {
    super(props);

    const s: PrintPassageState = {
      ...notStatePrefDefault,
      ...(getStatePref('prefs', 'printPassage') as typeof S.prefs.printPassage),
      ...(openedWinState || {}),
    };
    openedWinState = {};
    s.chapters = validPassage(s.chapters);
    this.state = s;

    // Without the next save, prefs would somehow overwrite state
    // before first render!
    setStatePref('prefs', 'printPassage', null, s);

    this.renderPromises = [];

    this.textdiv = React.createRef();
    this.pagebuttons = React.createRef();

    this.handler = handlerH.bind(this);
    this.vkSelectHandler = vkSelectHandlerH.bind(this);
    this.placePagingButtons = this.placePagingButtons.bind(this);
  }

  componentDidMount() {
    const state = this.state as PrintPassageState;
    setStatePref('prefs', 'printPassage', null, state);
    this.forceUpdate(); // for portal DOM target
  }

  componentDidUpdate(
    _prevProps: PrintPassageProps,
    prevState: PrintPassageState
  ) {
    const state = this.state as PrintPassageState;
    const { showpage } = state;
    const { textdiv } = this;
    const tdiv = textdiv.current;
    let { renderPromises } = this;
    const { chapters } = state;
    const valid = validPassage(chapters);
    if (diff(chapters, valid)) {
      this.setState({ chapters: valid });
    } else if (tdiv) {
      setStatePref('prefs', 'printPassage', prevState, state);
      this.placePagingButtons();
      const { checkbox } = state;
      if (!chapters) return;
      if (prevState.showpage !== showpage) {
        tdiv.scrollLeft = Math.floor(
          (showpage - 1) * (tdiv.clientWidth + 13.5)
        );
      }
      const { vkmod, book, chapter, lastchapter, v11n } = chapters;
      const show = { ...checkbox, strongs: false, morph: false };
      const renderkey = stringHash(vkmod, chapter, lastchapter, show);
      if (lastchapter && tdiv.dataset.renderkey !== renderkey) {
        tdiv.dataset.renderkey = renderkey;
        const rendering = renderPromises.find((p) => p.isPending);
        if (rendering) {
          rendering.reject(new Error('Canceled'));
          return;
        }
        this.setState({ showpage: 1 });
        renderPromises = [];
        const settings = {
          module: vkmod,
          show,
          ilModule: undefined,
          ilModuleOption: [],
          modkey: '',
          place: {
            footnotes: 'notebox',
            crossrefs: 'notebox',
            usernotes: 'notebox',
          } as const,
        };
        const renderChaps: [OSISBookType, number][] = [];
        for (let ch = chapter; ch <= lastchapter; ch += 1) {
          if (book) renderChaps.push([book, ch]);
        }

        // Write first page to DOM for user to see right away
        sanitizeHTML(tdiv, '');
        let pageIsFull = false;
        const renderHTML: string[] = [];
        renderChaps.forEach((c) => {
          if (!pageIsFull && tdiv) {
            log.silly(`Showing chapter ${c[0]} ${c[1]}`);
            renderHTML.push(
              bibleChapterText({
                ...settings,
                location: { book: c[0], chapter: c[1], v11n },
              })
            );
            sanitizeHTML(tdiv, renderHTML.join());
            if (tdiv.scrollWidth > tdiv.offsetWidth) {
              pageIsFull = true;
            }
          }
        });
        log.debug(`Finished previwing ${renderHTML.length} chapters to DOM`);

        // Then asynchronously generate all other chapters with a progress bar
        Subscription.publish.setWindowRootState({
          printDisabled: true,
        });
        this.setState({ progress: 0 });
        setTimeout(
          () =>
            (async function writeToDOM(
              xthis: PrintPassageWin,
              key: string,
              chaps: [OSISBookType, number][],
              html: string[]
            ) {
              let prog = 0;
              const funcs = chaps.map((c, i) => {
                return async (): Promise<string> => {
                  return new Promise((resolve, reject) =>
                    setTimeout(() => {
                      if (html[i]) resolve(html[i]);
                      else {
                        const tdivx = xthis.textdiv.current;
                        if (tdivx && key === tdivx.dataset.renderkey) {
                          log.silly(`Building chapter ${c[0]} ${c[1]}`);
                          prog += 1;
                          xthis.setState({ progress: prog / chaps.length });
                          resolve(
                            bibleChapterText({
                              ...settings,
                              location: {
                                book: c[0],
                                chapter: c[1],
                                v11n,
                              },
                            })
                          );
                        } else reject(new Error(`Canceled`));
                      }
                    }, 1)
                  );
                };
              });
              try {
                renderPromises = funcs.map((f) => querablePromise(f()));
                const html2 = await Promise.all(renderPromises);
                const tdivx = xthis.textdiv.current;
                if (tdivx) sanitizeHTML(tdivx, html2.join());
                log.debug(`Finished loading ${html2.length} chapters to DOM`);
              } catch (er) {
                log.warn(er);
              } finally {
                xthis.setState({ progress: -1 });
                Subscription.publish.setWindowRootState({
                  printDisabled: false,
                });
              }
            })(this, renderkey, renderChaps, renderHTML),
          1000
        );
      }
    }
  }

  placePagingButtons() {
    const { textdiv, pagebuttons } = this;
    const tdiv = textdiv.current;
    const pbts = pagebuttons.current;
    if (tdiv && pbts) {
      const box = textdiv.current.getBoundingClientRect();
      const boxw = box.right - box.left;
      pbts.style.top = `${box.bottom + 60}px`;
      pbts.style.left = `${box.left}px`;
      pbts.style.width = `${boxw}px`;
    }
  }

  render() {
    const state = this.state as PrintPassageState;
    const { checkbox, chapters, progress } = state;
    const {
      textdiv,
      pagebuttons,
      handler,
      vkSelectHandler,
      placePagingButtons,
    } = this;
    const vkmod = chapters?.vkmod;
    if (!vkmod || !chapters) return null;

    const showpaging =
      (textdiv.current?.scrollWidth ?? 0) > (textdiv.current?.clientWidth ?? 0);

    const isHebrew = /^heb?$/i.test(G.Tab[vkmod].lang);
    const tr = isHebrew ? 1 : 0;

    const printControl = document.getElementById(
      'printControl'
    ) as HTMLDivElement | null;

    return (
      <>
        <div
          ref={textdiv}
          className="print-passage-text userFontBase"
          dir={G.Tab[vkmod].direction || 'auto'}
        />
        {printControl &&
          ReactDOM.createPortal(
            <>
              <Groupbox
                className="progress-anchor"
                caption={G.i18n.t('menu.printPassage')}
              >
                <VKSelect
                  id="chapters"
                  selectVKM={{ ...chapters, vkmod }}
                  options={{
                    verses: [],
                    lastverses: [],
                  }}
                  onSelection={vkSelectHandler}
                />
                {progress !== -1 && (
                  <ProgressBar
                    value={progress}
                    intent="primary"
                    animate
                    stripes
                  />
                )}
              </Groupbox>
              {progress === -1 && showpaging && (
                <Hbox domref={pagebuttons} className="page-buttons">
                  <Button
                    id="pagefirst"
                    icon="double-chevron-left"
                    onClick={handler}
                  />
                  <Spacer flex="1" />
                  <Button id="pageprev" icon="chevron-left" onClick={handler} />
                  <Button
                    id="pagenext"
                    icon="chevron-right"
                    onClick={handler}
                  />
                  <Spacer flex="1" />
                  <Button
                    id="pagelast"
                    icon="double-chevron-right"
                    onClick={handler}
                  />
                </Hbox>
              )}

              <Groupbox caption={G.i18n.t('include.label')}>
                <Grid>
                  <Rows>
                    {switches[0]
                      .filter((r) => r[tr] > 0)
                      .map((c) => (
                        <Row key={c.join('.')} />
                      ))}
                  </Rows>
                  <Columns>
                    {switches.map((cols) => (
                      <Column key={[tr, ...cols.map((c) => c[2])].join('.')}>
                        {cols.map((c) => {
                          const key = [c[tr], c[2]].join('.');
                          let cb: ReactElement | null = null;
                          if (c[tr] === 1) {
                            cb = (
                              <Checkbox
                                key={key}
                                id={c[2]}
                                label={G.i18n.t(c[3])}
                                checked={checkbox[c[2]]}
                                disabled={
                                  c[2] === 'crossrefsText' &&
                                  !checkbox.crossrefs
                                }
                                onChange={handler}
                              />
                            );
                          } else if (c[tr] === 2) {
                            cb = <div key={key} />;
                          }
                          return cb;
                        })}
                      </Column>
                    ))}
                  </Columns>
                </Grid>
              </Groupbox>
              <PrintSettings
                pageable
                printDisabled={progress !== -1}
                dialogEnd="close"
                onClick={() => setTimeout(placePagingButtons, 100)}
              />
            </>,
            printControl
          )}
      </>
    );
  }
}
PrintPassageWin.defaultProps = defaultProps;
PrintPassageWin.propTypes = propTypes;

renderToRoot(<PrintPassageWin />, {
  printControl: <div id="printControl" />,
  initialWindowRootState: {
    showPrintOverlay: true,
    modal: 'outlined',
    iframeFilePath: '',
    printDisabled: false,
    progress: -1,
  },
});
