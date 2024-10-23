import React from 'react';
import ReactDOM from 'react-dom';
import { ProgressBar } from '@blueprintjs/core';
import Subscription from '../../../subscription.ts';
import { diff, randomID, sanitizeHTML, stringHash } from '../../../common.ts';
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
import type { AtextPropsType, OSISBookType, V11nType } from '../../../type.ts';
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
if (Build.isWebApp) {
  (switches[0] as any)[2] = [0, 0, 'usernotes', 'menu.view.usernotes'];
}

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

  componentInstanceID: string;

  constructor(props: PrintPassageProps) {
    super(props);

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);

    const s: PrintPassageState = {
      renderPromiseID: 0,
      ...notStatePrefDefault,
      ...(getStatePref('prefs', 'printPassage') as typeof S.prefs.printPassage),
    };
    if (s.chapters) {
      const { chapter, lastchapter } = s.chapters;
      if (chapter && !lastchapter) s.chapters.lastchapter = chapter;
    }
    const vc = validPassage(s.chapters, this.renderPromise);
    if (!this.renderPromise.waiting()) s.chapters = vc;
    this.state = s;

    this.pagebuttons = React.createRef();
    this.componentInstanceID = randomID();

    this.handler = handlerH.bind(this);
    this.vkSelectHandler = vkSelectHandlerH.bind(this);
  }

  componentDidMount() {
    const { renderPromise } = this;
    const state = this.state as PrintPassageState;
    setStatePref('prefs', 'printPassage', null, state);
    renderPromise.dispatch();
    this.forceUpdate(); // for portal DOM target
  }

  componentDidUpdate(
    _prevProps: PrintPassageProps,
    prevState: PrintPassageState,
  ) {
    const { componentInstanceID, renderPromise } = this;
    const state = this.state as PrintPassageState;
    const tdiv = printRefs.printContainerRef.current;
    const { checkbox, chapters, progress } = state;

    const valid = validPassage(chapters, renderPromise);
    // An invalid passage must be updated to a valid one.
    if (!renderPromise.waiting() && diff(chapters, valid)) {
      this.setState({ chapters: valid });
    } else if (chapters) {
      setStatePref('prefs', 'printPassage', prevState, state);
      const { vkMod, book, chapter, lastchapter, v11n } = chapters;
      if (vkMod && lastchapter && tdiv) {
        // Insure controller has current direction and printDisabled settings.
        Subscription.publish.setControllerState(
          {
            print: {
              printDisabled: progress !== -1,
              direction: G.Tab[vkMod].direction || 'auto',
            } as PrintOptionsType,
          },
          true, // merge above into existing PrintOptionsType
        );

        // Insure current selection will be rendered to tdiv.
        const show: AtextPropsType['show'] & {
          introduction: boolean;
          crossrefsText: boolean;
        } = { ...checkbox, strongs: false, morph: false };
        if (Build.isWebApp) show.usernotes = false;
        const renderkey = stringHash(
          vkMod,
          book,
          chapter,
          lastchapter,
          v11n,
          show,
          componentInstanceID,
        );
        if (tdiv.dataset.renderkey !== renderkey) {
          // Set renderkey now because soon the soon-to-be scheduled operations will
          // self terminate if tdiv renderkey changes.
          tdiv.dataset.renderkey = renderkey;
          this.renderChapters(
            tdiv,
            renderkey,
            vkMod,
            book,
            chapter,
            lastchapter,
            v11n,
            show,
          ).catch((er) => log.error(er))
        }
      }
    }
    renderPromise.dispatch();
  }

  async renderChapters(
    tdiv: HTMLDivElement,
    renderkey: string,
    vkMod: string,
    book: OSISBookType,
    chapter: number,
    lastchapter: number,
    v11n: V11nType | null,
    show: AtextPropsType['show'] & {
      introduction: boolean;
      crossrefsText: boolean;
    },
  ) {
    sanitizeHTML(tdiv, '');
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
      renderChaps.push([book, ch]);
    }
    const numChapters = renderChaps.length;

    // Electron app can write first page to DOM for user to see right away.
    if (Build.isElectronApp) {
      const dummyPromise = new RenderPromise(null);
      for (;;) {
        const renderChap = renderChaps.shift();
        if (!renderChap) break;
        const [book, chapter] = renderChap;
        log.debug(`Showing chapter ${book} ${chapter}`);
        tdiv.innerHTML += sanitizeHTML(
          bibleChapterText(
            {
              ...settings,
              location: { book, chapter, v11n },
            },
            dummyPromise,
          ),
        );
        if (tdiv.scrollWidth > tdiv.offsetWidth) {
          break;
        }
      }
      log.debug(`Finished previewing first page to DOM`);
    }

    if (!renderChaps.length) {
      printRefs.setPages();
      return numChapters;
    }

    // Render the remaining chapters asynchronously with a progress bar
    return new Promise((resolve) => {
      Subscription.publish.setControllerState(
        {
          print: { printDisabled: true } as PrintOptionsType,
        },
        true, // merge above into existing PrintOptionsType
      );
      this.setState({ progress: 0 } as PrintPassageState);

      let pages = 0;

      const funcs = renderChaps.map((c) => {
        const [book, chapter] = c;
        return () => {
          const tdivx = printRefs.printContainerRef.current;
          if (tdivx && tdivx.dataset.renderkey === renderkey) {
            const chapterText = bibleChapterText(
              {
                ...settings,
                location: { book, chapter, v11n },
              },
              renderPromise2,
            );
            if (renderPromise2.waiting()) return null;
            else {
              pages += 1;
              this.setState({
                progress: pages / C.UI.Print.maxPages,
              });
              return chapterText;
            }
          } else throw new Error(`Canceled`);
        };
      });

      // renderers() resolves if all chapters rendered or if the renderkey
      // changed, otherwise dispatching renderPromise2 will run it again.
      // This function renders each chapter successively into tdiv until:
      // - All chapters are rendered (return true)
      // - The page limit is reached (return true)
      // - renderPromise2 is waiting (return null)
      // - tdiv renderkey changes    (return false)
      const renderers = async () => {
        let div = printRefs.printContainerRef.current;
        if (div && div.dataset.renderkey === renderkey) {
          for (;;) {
            const func = funcs.shift();
            if (!func) break;
            const h: string | null = await new Promise((resolve2) => {
              setTimeout(() => {
                let r: string | null = '';
                try {
                  r = func();
                } catch (er) {
                  log.warn(er);
                }
                resolve2(r);
              }, 1);
            });
            if (h === null) {
              // renderPromise2 is waiting and will re-start renderChapters
              funcs.unshift(func);
              renderPromise2.dispatch();
              return null;
            }
            div = printRefs.printContainerRef.current;
            if (!div || div.dataset.renderkey !== renderkey) break;
            log.debug(
              `Loading chapter to DOM: ${renderChaps.length - funcs.length}`,
            );
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
        }

        const finished = !!(div && div.dataset.renderkey === renderkey);
        this.setState({ progress: -1 } as PrintPassageState);
        Subscription.publish.setControllerState(
          {
            print: {
              printDisabled: false,
            } as PrintOptionsType,
          },
          true, // merge above into existing PrintOptionsType
        );
        printRefs.setPages();
        resolve(finished ? numChapters : 0);
      };

      const renderPromise2 = new RenderPromise(() => {
        renderers().catch((er) => log.error(er));
        return;
      }, printRefs.printContainerRef);

      renderers().catch((er) => log.error(er));
    });
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
                  language
                  description
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
