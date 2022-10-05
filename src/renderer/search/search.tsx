/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import i18n from 'i18next';
import { ProgressBar } from '@blueprintjs/core';
import { clone, diff, drop, dString, sanitizeHTML } from '../../common';
import C from '../../constant';
import G from '../rg';
import renderToRoot from '../rinit';
import { windowArgument } from '../rutil';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import { Box, Hbox, Vbox } from '../libxul/boxes';
import Groupbox from '../libxul/groupbox';
import Label from '../libxul/label';
import Button from '../libxul/button';
import Menulist from '../libxul/menulist';
import Radio from '../libxul/radio';
import Grid, { Column, Columns, Row, Rows } from '../libxul/grid';
import Textbox from '../libxul/textbox';
import Spacer from '../libxul/spacer';
import Stack from '../libxul/stack';
import ModuleMenu from '../libxul/modulemenu';
import handlerH, {
  search,
  searchArg,
  hilightStrongs,
  formatResult,
  lexicon,
  strongsCSS,
} from './searchH';
import './search.css';

import type { GlobalPrefType, SearchType } from '../../type';

const defaultProps = xulDefaultProps;

const propTypes = {
  ...xulPropTypes,
};

type SearchWinProps = XulProps;

const initialState = {
  module: '' as string, // search module
  searchtext: '' as string, // search text
  searchtype: 'SearchExactText' as SearchType['type'], // type of search to do
  scoperadio: 'all' as 'all' | 'ot' | 'nt' | 'book' | 'other', // scope radio value
  scopeselect: 'gospel' as
    | 'custom'
    | 'pentateuch'
    | 'history'
    | 'wisdom'
    | 'prophets'
    | 'gospel'
    | 'letters', // scope select value
  moreLess: false as boolean, // more / less state
  displayBible: '' as string, // current module of Bible search
  count: 0 as number, // count and page-result are returned at different times
  pageindex: 0 as number, // first results index to show
  progress: 0 as number, // -1=indeterminate, 0=hidden, 1=complete
  progressLabel: '' as string, // changing progress label
};

// These state properties will not be persisted if xulsword is closed.
const noPersist = [
  'results',
  'pageindex',
  'progress',
  'progressLabel',
] as (keyof SearchWinState)[];

let resetState = null as null | SearchWinState;

export type SearchWinState = typeof initialState;

export default class SearchWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  handler: (e: React.SyntheticEvent) => void;

  resref: React.RefObject<HTMLDivElement>;

  lexref: React.RefObject<HTMLDivElement>;

  constructor(props: SearchWinProps) {
    super(props);

    const abible = G.Tabs.find((t) => t.type === C.BIBLE);

    const s: SearchWinState = {
      ...initialState,
      module: searchArg.module,
      searchtext: searchArg.searchtext,
      searchtype: searchArg.type,
      displayBible:
        searchArg.module && G.Tab[searchArg.module].type === C.BIBLE
          ? searchArg.module
          : abible?.module ?? '',
    };
    // Adjustments for special startup situations
    if (searchArg?.scope) {
      s.scoperadio = 'other';
      s.scopeselect = 'custom';
    }
    if (!s.moreLess && s.module && !G.LibSword.luceneEnabled(s.module)) {
      s.moreLess = true;
    }

    const pstate = windowArgument('pstate') as SearchWinState;
    this.state = resetState || pstate || s;

    this.handler = handlerH.bind(this);

    this.resref = React.createRef();
    this.lexref = React.createRef();
  }

  componentDidMount() {
    search(this);
  }

  componentDidUpdate(_prevProps: any, prevState: SearchWinState) {
    const state = this.state as SearchWinState;
    resetState = clone(state);
    const pstate = drop(state, noPersist) as Partial<SearchWinState>;
    if (diff(prevState, pstate)) {
      noPersist.forEach((p) => {
        pstate[p] = initialState[p] as any;
      });
      G.Window.setComplexValue('pstate', pstate);
    }

    const { displayBible, module, pageindex, count, searchtext } = state;
    const { resref, lexref } = this;
    const res = resref !== null ? resref.current : null;
    const lex = lexref !== null ? lexref.current : null;
    if (res && module) {
      const dModule = G.Tab[module].type === C.BIBLE ? displayBible : module;

      let dModuleIsStrongs = false;
      if (
        res.dataset.count !== count.toString() ||
        res.dataset.module !== dModule ||
        res.dataset.pageindex !== pageindex.toString()
      ) {
        strongsCSS.added.forEach((r) => {
          strongsCSS.sheet.deleteRule(r);
        });
        strongsCSS.added = [];
        if (!count) {
          sanitizeHTML(res, '');
        } else {
          // build a page from results, module and pageindex
          if (G.Tab[dModule].isVerseKey) {
            dModuleIsStrongs = /Strongs/i.test(
              G.LibSword.getModuleInformation(dModule, 'Feature') +
                G.LibSword.getModuleInformation(dModule, 'GlobalOptionFilter')
            );
          }
          const result = G.LibSword.getSearchResults(
            dModule,
            pageindex,
            C.UI.Search.resultsPerPage,
            dModuleIsStrongs,
            null
          );
          sanitizeHTML(res, result);
          formatResult(res, state);
          if (dModuleIsStrongs && /lemma:/.test(searchtext)) {
            hilightStrongs(searchtext.match(/lemma:\s*\S+/g));
          }
        }
      }

      if (
        dModuleIsStrongs &&
        lex &&
        (res.dataset.count !== count.toString() ||
          res.dataset.module !== dModule)
      ) {
        // build a lexicon for the search
        if (!count) {
          sanitizeHTML(lex, '');
        } else {
          lexicon(lex, state);
        }
      }

      res.dataset.count = count.toString();
      res.dataset.module = dModule;
      res.dataset.pageindex = pageindex.toString();
    }
  }

  render() {
    const state = this.state as SearchWinState;
    const { handler } = this;
    const {
      module,
      searchtext,
      searchtype,
      scoperadio,
      scopeselect,
      count,
      moreLess,
      pageindex,
      progress,
      progressLabel,
      displayBible,
    } = state;

    const searchTypes: SearchType['type'][] = [
      'SearchAnyWord',
      'SearchSimilar',
      'SearchExactText',
      'SearchAdvanced',
    ];

    const scopeSelectOptions: typeof scopeselect[] = [
      'pentateuch',
      'history',
      'wisdom',
      'prophets',
      'gospel',
      'letters',
    ];
    if (searchArg.scope) scopeSelectOptions.unshift('custom');

    const scopeOptions = scopeSelectOptions.map((option) => {
      return (
        <option key={option} value={option}>
          {option === 'custom' ? searchArg.scope : i18n.t(`${option}.label`)}
        </option>
      );
    });

    const location = G.Prefs.getComplexValue(
      'xulsword.location'
    ) as GlobalPrefType['xulsword']['location'];

    const searchindex = module && G.LibSword.luceneEnabled(module);

    const lasti =
      count - pageindex < C.UI.Search.resultsPerPage
        ? count
        : pageindex + C.UI.Search.resultsPerPage;
    let searchStatus = '';
    if (count > C.UI.Search.resultsPerPage) {
      searchStatus = i18n.t('searchStatusPage', {
        v1: dString(pageindex + 1),
        v2: dString(lasti),
        v3: dString(count),
      });
    } else {
      searchStatus = i18n.t('searchStatusAll', {
        v1: dString(count || 0),
      });
    }

    // TODO!: Popup
    return (
      <Vbox className="searchwin">
        <Hbox pack="center">
          <Grid
            className={['search-grid', moreLess ? 'more' : 'less'].join(' ')}
          >
            <Columns>
              <Column width="min-content" />
              <Column width="min-content" />
            </Columns>
            <Rows>
              <Row>
                <Groupbox align="center">
                  <Button id="moreLess" orient="vertical" onClick={handler}>
                    <Label value={i18n.t('more.label')} />
                    <Label value={i18n.t('less.label')} />
                  </Button>
                  <Spacer flex="1" orient="horizontal" />
                  <Hbox className="searchtextLabel" align="start">
                    <Label
                      control="searchtext"
                      value={`${i18n.t('searchtext.label')}:`}
                    />
                  </Hbox>
                  <Vbox className="searchtext">
                    <Textbox
                      id="searchtext"
                      value={searchtext}
                      tooltip={i18n.t('searchbox.tooltip')}
                      maxLength="60"
                      onChange={handler}
                    />
                    <ModuleMenu id="module" value={module} onChange={handler} />
                  </Vbox>
                  <Button
                    id="searchButton"
                    disabled={progress !== 0}
                    label={i18n.t('searchBut.label')}
                    tooltip={i18n.t('search.tooltip')}
                    onClick={handler}
                  />
                  <Spacer flex="1" orient="horizontal" />
                  <Button id="helpButton" onClick={handler} />
                </Groupbox>
              </Row>
              <Row>
                <Stack
                  className="searchType"
                  orient="horizontal"
                  align="stretch"
                >
                  <Groupbox
                    id="searchtype"
                    caption={i18n.t('searchType.label')}
                    orient="vertical"
                    onChange={handler}
                  >
                    {searchTypes.map((st) => (
                      <Radio
                        key={['type', st].join('.')}
                        name="type"
                        checked={searchtype === st}
                        value={st}
                        label={i18n.t(`${st}.label`)}
                        tooltip={i18n.t(`${st}.tooltip`)}
                      />
                    ))}
                  </Groupbox>
                  {!searchindex && (
                    <>
                      <Vbox />
                      <Vbox align="center">
                        <Button
                          id="createIndexButton"
                          label={i18n.t('createIndex.label')}
                          onClick={handler}
                        />
                      </Vbox>
                    </>
                  )}
                </Stack>
                <Groupbox
                  id="scoperadio"
                  caption={i18n.t('searchScope.label')}
                  onChange={handler}
                >
                  <Grid>
                    <Columns>
                      <Column width="min-content" />
                      <Column width="min-content" />
                    </Columns>
                    <Rows>
                      <Row>
                        <Radio
                          name="scope"
                          checked={scoperadio === 'all'}
                          value="all"
                          label={i18n.t('search.all')}
                        />
                        <Radio
                          name="scope"
                          checked={scoperadio === location?.book ?? ''}
                          value={location?.book ?? ''}
                          label={i18n.t('search.currentBook')}
                        />
                      </Row>
                      <Row>
                        <Radio
                          name="scope"
                          checked={scoperadio === 'ot'}
                          value="ot"
                          label={i18n.t('search.ot')}
                        />
                        <Radio
                          name="scope"
                          checked={scoperadio === 'nt'}
                          value="nt"
                          label={i18n.t('search.nt')}
                        />
                      </Row>
                      <Row>
                        <div>
                          <Radio
                            name="scope"
                            checked={scoperadio === 'other'}
                            value="other"
                            label={`${i18n.t('search.groups')}:`}
                          />
                          <Menulist
                            id="scopeselect"
                            value={scopeselect}
                            options={scopeOptions}
                            disabled={scoperadio !== 'other'}
                            onChange={handler}
                          />
                        </div>
                      </Row>
                    </Rows>
                  </Grid>
                </Groupbox>
              </Row>
            </Rows>
          </Grid>
        </Hbox>

        <Spacer height={moreLess ? '20' : '10'} />

        <Vbox className="result-container" flex="1">
          <Hbox flex="1">
            <Vbox className="resultBox" flex="1">
              <Hbox>
                <Box flex="1">
                  <div
                    id="lexiconResults"
                    ref={this.lexref}
                    onClick={handler}
                  />
                </Box>
                {module && G.Tab[module].type === C.BIBLE && (
                  <ModuleMenu
                    id="displayBible"
                    value={displayBible}
                    types={[C.BIBLE]}
                    disabled={!module || G.Tab[module].type !== C.BIBLE}
                    onChange={handler}
                  />
                )}
              </Hbox>
              <Spacer orient="horizontal" />
              <div id="searchResults" ref={this.resref} onClick={handler} />
            </Vbox>
            {count > C.UI.Search.resultsPerPage && (
              <Vbox>
                <Button id="pagefirst" onClick={handler} />
                <Spacer orient="vertical" flex="1" />
                <Button id="pageprev" onClick={handler} />
                <Button id="pagenext" onClick={handler} />
                <Spacer orient="vertical" flex="1" />
                <Button id="pagelast" onClick={handler} />
              </Vbox>
            )}
          </Hbox>
          <Hbox className="searchStatus" pack="start" align="center">
            <Box>
              <span>{searchStatus}</span>
            </Box>
            <Spacer flex="1" />
            {progress !== 0 && (
              <Hbox align="center">
                <Label value={`${progressLabel}:`} />
                <ProgressBar value={progress === -1 ? undefined : progress} />
              </Hbox>
            )}
          </Hbox>
        </Vbox>
      </Vbox>
    );
  }
}
SearchWin.defaultProps = defaultProps;
SearchWin.propTypes = propTypes;

renderToRoot(<SearchWin height="100%" />);
