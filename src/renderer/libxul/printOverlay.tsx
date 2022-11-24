/* eslint-disable jsx-a11y/iframe-has-title */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/forbid-prop-types */
import React, { ReactElement } from 'react';
import PropTypes from 'prop-types';
import i18n from 'i18next';
import G from '../rg';
import { Hbox, Vbox } from './boxes';
import Button from './button';
import Spacer from './spacer';
import PrintSettings from './printSettings';
import { xulDefaultProps, XulProps, xulPropTypes } from './xul';
import './printOverlay.css';

const defaultProps = {
  ...xulDefaultProps,
  customControl: null,
  showColumnButton: false,
  iframeFilePath: '',
  printDisabled: false,
};

const propTypes = {
  ...xulPropTypes,
  content: PropTypes.object.isRequired,
  customControl: PropTypes.object,
  showColumnButton: PropTypes.bool,
  iframeFilePath: PropTypes.string,
  printDisabled: PropTypes.bool,
  iframeBackHandler: PropTypes.func.isRequired,
};

type PrintOverlayProps = XulProps & {
  content: ReactElement; // content to print will be shown in the overlay
  customControl: ReactElement | null; // UI controlling any custom print settings
  showColumnButton: boolean;
  printDisabled: boolean;
  iframeFilePath: string; // filepath of a PDF preview of the content
  iframeBackHandler: () => void; // called when 'back' is clicked on PDF preview
};

export default function PrintOverlay(props: PrintOverlayProps) {
  const {
    customControl,
    iframeFilePath,
    content,
    printDisabled,
    showColumnButton,
    iframeBackHandler: backHandler,
  } = props;

  return (
    <>
      {iframeFilePath && (
        <Vbox className="pdf-preview" pack="start" align="stretch">
          <Hbox flex="1">
            <iframe key={iframeFilePath} src={G.inlineFile(iframeFilePath)} />
          </Hbox>
          <Hbox className="dialog-buttons" pack="end" align="end">
            <Spacer flex="10" />
            <Button id="back" flex="1" fill="x" onClick={backHandler}>
              {i18n.t('back.label')}
            </Button>
          </Hbox>
        </Vbox>
      )}
      {!iframeFilePath && (
        <Hbox className="html-preview" align="stretch">
          <Vbox>
            <div id="html-page" className="html-page">
              <div className="scale">
                <div className="content">{content}</div>
              </div>
            </div>
          </Vbox>
          <Vbox className="print-settings">
            <Spacer flex="1" />
            <PrintSettings
              columnSelect={showColumnButton}
              control={customControl}
              printDisabled={printDisabled}
            />
            <Spacer flex="1" />
          </Vbox>
        </Hbox>
      )}
    </>
  );
}
PrintOverlay.defaultProps = defaultProps;
PrintOverlay.propTypes = propTypes;
