/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import i18n from 'i18next';
import renderToRoot from '../rinit';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import { Hbox, Vbox, Box } from '../libxul/boxes';
import Groupbox from '../libxul/groupbox';
import Button from '../libxul/button';
import Spacer from '../libxul/spacer';
import handlerH from './moduleDownloaderH';
import './moduleDownloader.css';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

type ModuleDownloaderProps = XulProps;

type ModuleDownloaderState = {
  language: string | null;
  module: string[] | null;
  moduleSource: string[] | null;

  showModuleInfo: boolean;
  downloading: boolean;
  polling: boolean;

  languageListOpen: boolean;
  languageListPanelWidth: number;
  moduleSourceOpen: boolean;
  moduleSourcePanelHeight: number;
};

export default class ModuleDownloader extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  handler: (e: React.SyntheticEvent) => void;

  constructor(props: ModuleDownloaderProps) {
    super(props);

    const s: ModuleDownloaderState = {
      language: null,
      module: null,
      moduleSource: null,

      showModuleInfo: false,
      downloading: false,
      polling: false,

      languageListOpen: true,
      languageListPanelWidth: 180,
      moduleSourceOpen: false,
      moduleSourcePanelHeight: 350,
    };
    this.state = s;

    this.handler = handlerH.bind(this);
  }

  render() {
    const state = this.state as ModuleDownloaderState;
    const {
      language,
      module,
      moduleSource,
      downloading,
      polling,
      languageListOpen,
      languageListPanelWidth,
      showModuleInfo,
      moduleSourceOpen,
      moduleSourcePanelHeight,
    } = state;
    const { handler } = this;
    const buttonWidth = 80;

    const disable = {
      download: !module,
      moduleInfo: !module,
      moduleInfoBack: false,
      cancel: !downloading,
      repoToggle: !moduleSource,
      repoAdd: false,
      repoDelete: !moduleSource,
      repoCancel: !polling,
    };
    return (
      <Vbox flex="1" height="100%">
        <Hbox flex="1">
          {languageListOpen && (
            <>
              <Groupbox
                caption={i18n.t('menu.options.language')}
                orient="vertical"
                width={`${languageListPanelWidth}`}
              >
                <Box flex="1" />
                <Button
                  id="languageListClose"
                  onClick={() => this.setState({ languageListOpen: false })}
                />
              </Groupbox>
              <Spacer id="languageListSizer" width="10" />
            </>
          )}
          {!languageListOpen && (
            <Groupbox orient="vertical">
              <Button
                id="languageListOpen"
                flex="1"
                onClick={() => this.setState({ languageListOpen: true })}
              />
            </Groupbox>
          )}

          <Groupbox
            caption={i18n.t('menu.addNewModule.label')}
            orient="horizontal"
            flex="1"
          >
            <Hbox flex="1">
              {showModuleInfo && <div id="moduleInfo" />}
              {!showModuleInfo && <Box />}
            </Hbox>
            <Vbox pack="center" width={`${buttonWidth}`} onClick={handler}>
              <Button id="download" disabled={disable.download} />
              {!showModuleInfo && (
                <Button id="moduleInfo" disabled={disable.moduleInfo} />
              )}
              {showModuleInfo && (
                <Button id="moduleInfoBack" disabled={disable.moduleInfoBack} />
              )}
              <Button id="cancel" disabled={disable.cancel} />
            </Vbox>
          </Groupbox>
        </Hbox>

        {moduleSourceOpen && (
          <>
            <Spacer id="moduleSourceSizer" width="10" />
            <Groupbox
              caption={i18n.t('moduleSources.label')}
              height={`${moduleSourcePanelHeight}`}
              orient="horizontal"
              flex="1"
            >
              <Box flex="1" />
              <Vbox pack="center" width={`${buttonWidth}`} onClick={handler}>
                <Button id="repoToggle" disabled={disable.repoToggle} />
                <Button id="repoAdd" disabled={disable.repoAdd} />
                <Button id="repoDelete" disabled={disable.repoDelete} />
                <Button id="repoCancel" disabled={disable.repoCancel} />
              </Vbox>
            </Groupbox>
          </>
        )}

        <Hbox className="dialogbuttons" pack="end" align="end">
          {moduleSourceOpen && (
            <Button
              label={i18n.t('less.label')}
              width={`${2 * buttonWidth}`}
              onClick={() => this.setState({ moduleSourceOpen: false })}
            />
          )}
          {!moduleSourceOpen && (
            <Button
              label={i18n.t('moduleSources.label')}
              width={`${2 * buttonWidth}`}
              onClick={() => this.setState({ moduleSourceOpen: true })}
            />
          )}
          <Spacer flex="1" />
          <Button
            id="cancel"
            label={i18n.t('cancel.label')}
            onClick={handler}
          />
          <Button id="ok" label={i18n.t('ok.label')} onClick={handler} />
        </Hbox>
      </Vbox>
    );
  }
}
ModuleDownloader.defaultProps = defaultProps;
ModuleDownloader.propTypes = propTypes;

renderToRoot(<ModuleDownloader />);
