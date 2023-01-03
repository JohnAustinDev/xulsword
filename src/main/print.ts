import {
  dialog,
  BrowserWindow,
  SaveDialogOptions,
  IpcMainInvokeEvent,
} from 'electron';
import i18n from 'i18next';
import log from 'electron-log';
import { randomID } from '../common';
import LocalFile from './components/localFile';
import Window from './components/window';

const printPreviewTmps: LocalFile[] = [];

const MainPrintHandler = async (
  event: IpcMainInvokeEvent,
  electronOptions:
    | Electron.WebContentsPrintOptions
    | (Electron.PrintToPDFOptions & {
        destination: 'prompt-for-file' | 'iframe';
      })
): Promise<string> => {
  if (event.sender) {
    if (!('destination' in electronOptions)) {
      // NOTE!: Electron contents.print() does not seem to work at all.
      // It complains there are no available printers (when there are)
      // but even when contents.getPrinters is used, nothing is returned.
      // On the other hand, window.print() works just fine, so that is
      // currently used instead.
      // Send to a printer
      const opts = electronOptions as Electron.WebContentsPrintOptions;
      return new Promise((resolve, reject) => {
        log.debug(`print: `, opts);
        event.sender.print(opts, (suceeded: boolean, failureReason: string) => {
          if (suceeded) resolve('printed');
          else reject(failureReason);
        });
      });
    }

    const { destination } = electronOptions;
    if (destination === 'prompt-for-file') {
      // Print to a user selected PDF file
      const saveops: SaveDialogOptions = {
        title: i18n.t('printCmd.label'),
        filters: [
          {
            name: 'PDF',
            extensions: ['pdf'],
          },
        ],
        properties: ['createDirectory'],
      };
      let wtp = BrowserWindow.fromWebContents(event.sender);
      let result;
      try {
        result = await ((wtp && dialog.showSaveDialog(wtp, saveops)) || null);
      } catch (er) {
        return Promise.reject(er);
      }
      wtp = null;
      if (result && !result.canceled && result.filePath) {
        log.debug(`printToPDF: `, electronOptions);
        try {
          const data = await event.sender.printToPDF(electronOptions);
          if (data) {
            const outfile = new LocalFile(result.filePath);
            outfile.writeFile(data);
            return await Promise.resolve(outfile.path);
          }
        } catch (er) {
          return Promise.reject(er);
        }
      }
    }
    // Print to temporary PDF file displayed in preview iframe
    printPreviewTmps.forEach((f) => {
      if (f.exists()) f.remove();
    });
    const tmp = new LocalFile(Window.tmpDir({ type: 'xulsword' })[0]);
    if (tmp.exists() && tmp.isDirectory()) {
      tmp.append(`${randomID()}.pdf`);
      log.debug(`printToPDF: `, electronOptions);
      try {
        const data = await event.sender.printToPDF(electronOptions);
        if (data) {
          tmp.writeFile(data);
          printPreviewTmps.push(tmp);
          return await Promise.resolve(tmp.path);
        }
      } catch (er) {
        return Promise.reject(er);
      }
    }
  }
  return Promise.resolve('');
};

export default MainPrintHandler;
