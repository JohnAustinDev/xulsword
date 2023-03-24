/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/iframe-has-title */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/forbid-prop-types */
import React, { ReactElement } from 'react';
import PropTypes from 'prop-types';
import Subscription from '../../subscription';
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
  pageable: undefined,
  showColumnButton: false,
  iframeFilePath: '',
  printDisabled: false,
};

const propTypes = {
  ...xulPropTypes,
  content: PropTypes.object.isRequired,
  customControl: PropTypes.object,
  pageable: PropTypes.object,
  iframeFilePath: PropTypes.string,
  printDisabled: PropTypes.bool,
};

type PrintOverlayProps = XulProps & {
  content: ReactElement; // content to print will be shown in the overlay
  customControl?: ReactElement | null; // UI controlling any custom print settings
  pageable?: {
    page: React.RefObject<HTMLDivElement>;
    text: React.RefObject<HTMLDivElement>;
  };
  printDisabled: boolean;
  iframeFilePath: string; // filepath of a PDF preview of the content
};

export default function PrintOverlay(props: PrintOverlayProps) {
  const { customControl, iframeFilePath, content, printDisabled, pageable } =
    props;
  let page;
  if (pageable) ({ page } = pageable);

  const backHandler = () =>
    Subscription.publish.setRendererRootState({
      showPrintOverlay: true,
      modal: 'outlined',
      iframeFilePath: '',
      printDisabled: false,
      progress: -1,
    });

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
              {G.i18n.t('back.label')}
            </Button>
          </Hbox>
        </Vbox>
      )}
      {!iframeFilePath && (
        <Hbox className="html-preview" align="stretch">
          <Spacer orient="vertical" flex="1" />
          <Vbox pack="center">
            <Spacer orient="horizontal" flex="1" />
            <div id="html-page" className="html-page" ref={page}>
              <div className="scale">
                <div className="content">{content}</div>
              </div>
            </div>
            <Spacer orient="horizontal" flex="1" />
          </Vbox>
          <Spacer orient="vertical" flex="1" />
          <Vbox className="print-settings">
            <Spacer flex="1" />
            {customControl}
            {!customControl && (
              <PrintSettings
                printDisabled={printDisabled}
                pageable={pageable}
                dialogEnd="cancel"
              />
            )}
            <Spacer flex="1" />
          </Vbox>
        </Hbox>
      )}
    </>
  );
}
PrintOverlay.defaultProps = defaultProps;
PrintOverlay.propTypes = propTypes;
