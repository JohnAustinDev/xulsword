/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import i18n from 'i18next';
import { ProgressBar } from '@blueprintjs/core';
import { clone, diff, drop, dString } from '../../common';
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
import handlerH from './searchH';
import './search.css';

import type { GlobalPrefType, LocationVKType, SearchType } from '../../type';

const ResultsPerPage = 30;

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
  results: [] as LocationVKType[],
  pageindex: 0 as number, // first results index to show
  progress: 0 as number, // between 0 and 1
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

const searchArg = windowArgument('search') as SearchType;

export default class SearchWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  handler: (e: React.SyntheticEvent) => void;

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
    if (searchArg?.scope) {
      s.scoperadio = 'other';
      s.scopeselect = 'custom';
    }
    const pstate = windowArgument('pstate') as SearchWinState;
    this.state = resetState || pstate || s;

    this.handler = handlerH.bind(this);
  }

  componentDidMount() {}

  componentDidUpdate(_prevProps: any, prevState: SearchWinState) {
    resetState = clone(this.state) as SearchWinState;
    const pstate = drop(this.state, noPersist) as Partial<SearchWinState>;
    if (diff(prevState, pstate)) {
      noPersist.forEach((p) => {
        pstate[p] = initialState[p] as any;
      });
      G.Window.setComplexValue('pstate', pstate);
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
      results,
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

    const searchindex = module && G.Tab[module].type === C.BIBLE;

    const lasti =
      results.length - pageindex < ResultsPerPage
        ? results.length
        : pageindex + ResultsPerPage;
    let searchStatus = '';
    if (results.length > ResultsPerPage) {
      searchStatus = i18n.t('searchStatusPage', {
        v1: dString(pageindex + 1),
        v2: dString(lasti),
        v3: dString(results.length),
      });
    } else {
      searchStatus = i18n.t('searchStatusAll', { v1: dString(results.length) });
    }

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
                    />
                    <ModuleMenu id="module" value={module} onChange={handler} />
                  </Vbox>
                  <Button
                    id="searchButton"
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

        <Vbox flex="1">
          <Hbox flex="1">
            <Vbox className="resultBox" flex="1">
              <Hbox>
                <Box flex="1" id="lexiconResults" />
                <ModuleMenu
                  id="displayBible"
                  value={displayBible}
                  types={[C.BIBLE]}
                  disabled={!module || G.Tab[module].type !== C.BIBLE}
                  onChange={handler}
                />
              </Hbox>
              <Box flex="1" id="searchResults" />
            </Vbox>
            {results.length > ResultsPerPage && (
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
          <Hbox pack="start">
            <div>
              <span>{searchStatus}</span>
            </div>
            <Spacer flex="1" />
            {progress > 0 && (
              <>
                <Label value={progressLabel} />
                <ProgressBar value={progress} />
                <Button
                  id="stopSearch"
                  label={i18n.t('stop.label')}
                  onClick={handler}
                />
              </>
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
