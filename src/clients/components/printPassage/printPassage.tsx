import React from 'react';
import ReactDOM from 'react-dom';
import { ProgressBar } from '@blueprintjs/core';
import Subscription from '../../../subscription.ts';
import { diff, sanitizeHTML, stringHash } from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import {
  getStatePref,
  setStatePref,
  libswordImgSrc,
  printRefs,
} from '../../common.tsx';
import log from '../../log.ts';
import RenderPromise, {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import { xulPropTypes } from '../../components/libxul/xul.tsx';
import Grid, {
  Column,
  Columns,
  Row,
  Rows,
} from '../../components/libxul/grid.tsx';
import Groupbox from '../../components/libxul/groupbox.tsx';
import Checkbox from '../../components/libxul/checkbox.tsx';
import SelectVK from '../../components/libxul/selectVK.tsx';
import {
  handler as handlerH,
  vkSelectHandler as vkSelectHandlerH,
  validPassage,
  bibleChapterText,
} from './printPassageH.tsx';
import '../../libsword.css';
import '../../components/atext/atext.css';
import './printPassage.css';

import type { ReactElement } from 'react';
import type { OSISBookType } from '../../../type.ts';
import type S from '../../../defaultPrefs.ts';
import type { PrintOptionsType } from '../../controller.tsx';
import type { XulProps } from '../../components/libxul/xul.tsx';

// The PrintPassage component utilizes state prefs to render a series of Bible
// chapters into the printContainerRef (provided via a prop). Custom settings
// provided to customSettingsRef allow users to select text options for print.

// TODO: As of 11/22 @page {@bottom-center {content: counter(page);}} does not work

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

const propTypes = {
  ...xulPropTypes,
};

export type PrintPassageProps = XulProps;

const notStatePrefDefault = {
  progress: -1 as number,
};

export type PrintPassageState = typeof S.prefs.printPassage &
  typeof notStatePrefDefault &
  RenderPromiseState;

export default class PrintPassage
  extends React.Component
  implements RenderPromiseComponent
{
  static propTypes: typeof propTypes;

  pagebuttons: React.RefObject<HTMLDivElement>;

  handler: typeof handlerH;

  vkSelectHandler: typeof vkSelectHandlerH;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  constructor(props: PrintPassageProps) {
    super(props);

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);

    const s: PrintPassageState = {
      renderPromiseID: 0,
      ...notStatePrefDefault,
      ...(getStatePref('prefs', 'printPassage') as typeof S.prefs.printPassage),
    };
    s.chapters = validPassage(s.chapters, this.renderPromise);
    this.state = s;

    this.pagebuttons = React.createRef();

    this.renderChapters = this.renderChapters.bind(this);
    this.handler = handlerH.bind(this);
    this.vkSelectHandler = vkSelectHandlerH.bind(this);
  }

  componentDidMount() {
    const state = this.state as PrintPassageState;
    setStatePref('prefs', 'printPassage', null, state);
    this.forceUpdate(); // for portal DOM target
  }

  componentDidUpdate(
    _prevProps: PrintPassageProps,
    prevState: PrintPassageState,
  ) {
    const { renderPromise } = this;
    const state = this.state as PrintPassageState;
    const tdiv = printRefs.printContainerRef.current;
    const { chapters, progress } = state;

    if (chapters) {
      const { vkMod } = chapters;
      if (vkMod) {
        Subscription.publish.setControllerState({
          print: {
            direction: G.Tab[vkMod].direction || 'auto',
          } as PrintOptionsType,
        });
      }
    }

    const valid = validPassage(chapters, renderPromise);
    if (prevState.progress !== -1 && progress === -1) {
      Subscription.publish.setControllerState(
        {
          print: { printDisabled: false } as PrintOptionsType,
        },
        true, // merge above into existing PrintOptionsType
      );
    } else if (diff(chapters, valid)) {
      this.setState({ chapters: valid });
    } else if (tdiv) {
      setStatePref('prefs', 'printPassage', prevState, state);
      this.renderChapters();
    }
  }

  renderChapters() {
    const { renderPromise } = this;
    const state = this.state as PrintPassageState;
    const { chapters } = state;
    const tdiv = printRefs.printContainerRef.current;
    if (!tdiv || !chapters) return;
    const { checkbox } = state;
    const { vkMod, book, chapter, lastchapter, v11n } = chapters;
    const show = { ...checkbox, strongs: false, morph: false };
    const renderkey = stringHash(vkMod, chapter, lastchapter, show);
    if (lastchapter && tdiv.dataset.renderkey !== renderkey) {
      tdiv.dataset.renderkey = renderkey;
      const settings = {
        module: vkMod,
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
      const renderChaps: Array<[OSISBookType, number]> = [];
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
            bibleChapterText(
              {
                ...settings,
                location: { book: c[0], chapter: c[1], v11n },
              },
              renderPromise,
            ),
          );
          sanitizeHTML(tdiv, renderHTML.join());
          if (tdiv.scrollWidth > tdiv.offsetWidth) {
            pageIsFull = true;
          }
        }
      });
      log.debug(`Finished previewing ${renderHTML.length} chapters to DOM`);

      // Then asynchronously generate all other chapters with a progress bar
      Subscription.publish.setControllerState(
        {
          print: { printDisabled: true } as PrintOptionsType,
        },
        true, // merge above into existing PrintOptionsType
      );
      this.setState({ progress: 0 });

      // Pause here so first page will appear to user.
      const defer = async () => {
        let pages = 0;
        const funcs = renderChaps.map(async (c, i) => {
          return async (): Promise<string> => {
            return await new Promise((resolve, reject) =>
              setTimeout(() => {
                if (renderHTML[i]) resolve(renderHTML[i]);
                else {
                  const tdivx = printRefs.printContainerRef.current;
                  if (tdivx && tdivx.dataset.renderkey === renderkey) {
                    // log.debug(`Building chapter ${c[0]} ${c[1]}`);
                    pages += 1;
                    this.setState({
                      progress: pages / C.UI.Print.maxPages,
                    });
                    resolve(
                      bibleChapterText(
                        {
                          ...settings,
                          location: {
                            book: c[0],
                            chapter: c[1],
                            v11n,
                          },
                        },
                        renderPromise,
                      ),
                    );
                  } else reject(new Error(`Canceled`));
                }
              }, 1),
            );
          };
        });
        let div = printRefs.printContainerRef.current;
        if (div && div.dataset.renderkey === renderkey) {
          div.innerHTML = '';
          try {
            while (funcs.length) {
              const func = funcs.shift() as Promise<() => Promise<string>>;
              log.debug(
                `Loading chapter to DOM: ${renderChaps.length - funcs.length}`,
              );
              const f = await func;
              const h = await f();
              div = printRefs.printContainerRef.current;
              if (!div || div.dataset.renderkey !== renderkey) break;
              div.innerHTML += sanitizeHTML(h);
              libswordImgSrc(div);
              pages = Math.floor(div.scrollWidth / div.clientWidth);
              if (pages > C.UI.Print.maxPages) {
                log.info(
                  `Stopping passage render at ${pages} pages (skipped ${funcs.length} chapters}).`,
                );
                break;
              }
            }
            if (div) {
              log.debug(
                `Finished loading ${Math.floor(
                  div.scrollWidth / div.clientWidth,
                )} pages to DOM`,
              );
            }
          } catch (er) {
            log.debug(er);
          }
        }
        if (div && div.dataset.renderkey === renderkey) {
          this.setState({ progress: -1 });
        }
      };

      setTimeout(() => {
        defer().catch((er) => {
          log.error(er);
        });
      }, 1);
    }
  }

  render() {
    const state = this.state as PrintPassageState;
    const { checkbox, chapters, progress } = state;
    const { loadingRef, renderPromise, handler, vkSelectHandler } = this;
    const vkMod = chapters?.vkMod;
    if (!vkMod || !chapters) return null;

    const { lang } = G.Tab[vkMod];
    const isHebrew = lang && /^heb?$/i.test(lang);
    const tr = isHebrew ? 1 : 0;

    const { book: b, chapter: c1, lastchapter: c2 } = chapters;
    const keySelectVK = [vkMod, b, c1, c2].join('.');

    return (
      <>
        {printRefs.customSettingsRef.current &&
          ReactDOM.createPortal(
            <>
              <Groupbox
                domref={loadingRef}
                className="passage-selector"
                caption={GI.i18n.t('', renderPromise, 'menu.printPassage')}
              >
                <SelectVK
                  id="chapters"
                  key={keySelectVK}
                  initialVK={{ ...chapters, vkMod }}
                  options={{
                    verses: [],
                    lastverses: [],
                    vkMods: 'Texts',
                  }}
                  onSelection={vkSelectHandler}
                />
                {progress !== -1 && (
                  <ProgressBar
                    value={undefined}
                    intent="primary"
                    animate
                    stripes
                  />
                )}
              </Groupbox>
              <Groupbox
                className="text-options"
                caption={GI.i18n.t('', renderPromise, 'include.label')}
              >
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
                                label={GI.i18n.t('', renderPromise, c[3])}
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
            </>,
            printRefs.customSettingsRef.current,
          )}
      </>
    );
  }
}
PrintPassage.propTypes = propTypes;
