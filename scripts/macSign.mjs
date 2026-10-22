/*global process */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

// electron-builder can only sign MacOS apps on MacOS. When packaging the
// MacOS app on Linux, this signs it with rcodesign instead (installed to
// Cpp/darwin-bin by init.sh), and also notarizes it when credentials are
// set. It must run from afterPack, because electron-builder skips the
// afterSign hook when it did not sign.
//
// Environment variables (see setenv):
//   MAC_SIGN_P12                 Developer ID Application certificate (.p12)
//   MAC_SIGN_P12_PASSWORD_FILE   File containing the .p12 password
//   MAC_NOTARY_API_KEY           App Store Connect API key JSON file, made with
//                                rcodesign encode-app-store-connect-api-key
// Without MAC_SIGN_P12 the app is only ad-hoc signed.
export default async function macSign(context) {
  const { appOutDir, packager } = context;
  const { projectDir } = packager;
  const { productFilename } = packager.appInfo;
  const appPath = path.join(appOutDir, `${productFilename}.app`);

  let rcodesign = path.join(projectDir, 'Cpp', 'darwin-bin', 'rcodesign');
  if (!fs.existsSync(rcodesign)) rcodesign = 'rcodesign';
  const run = (args) => {
    console.log(`rcodesign ${args.join(' ')}`);
    execFileSync(rcodesign, args, { stdio: 'inherit' });
  };

  const { MAC_SIGN_P12, MAC_SIGN_P12_PASSWORD_FILE, MAC_NOTARY_API_KEY } =
    process.env;
  const args = ['sign'];
  if (MAC_SIGN_P12) {
    if (!MAC_SIGN_P12_PASSWORD_FILE)
      throw new Error('MAC_SIGN_P12 requires MAC_SIGN_P12_PASSWORD_FILE.');
    // --for-notarization turns on the hardened runtime for all code and
    // requires a timestamp. Entitlements only apply to the path they are
    // scoped to, so they are given for the app and for each helper app.
    const entitlements = path.join(
      projectDir,
      'assets',
      'entitlements.mac.plist',
    );
    const frameworks = path.join(appPath, 'Contents', 'Frameworks');
    const helpers = fs
      .readdirSync(frameworks)
      .filter((name) => name.endsWith('.app'))
      .map((name) => `Contents/Frameworks/${name}`);
    args.push(
      '--p12-file',
      MAC_SIGN_P12,
      '--p12-password-file',
      MAC_SIGN_P12_PASSWORD_FILE,
      '--for-notarization',
      '--entitlements-xml-file',
      entitlements,
    );
    helpers.forEach((helper) =>
      args.push('--entitlements-xml-file', `${helper}:${entitlements}`),
    );
  } else {
    console.log(
      'MAC_SIGN_P12 is not set, so the MacOS app will only be ad-hoc signed.',
    );
  }
  args.push(appPath);
  run(args);

  if (MAC_SIGN_P12 && MAC_NOTARY_API_KEY) {
    run([
      'notary-submit',
      '--api-key-file',
      MAC_NOTARY_API_KEY,
      '--staple',
      appPath,
    ]);
  } else if (MAC_SIGN_P12) {
    console.log(
      'MAC_NOTARY_API_KEY is not set, so the MacOS app will not be notarized.',
    );
  }

  const release = path.join(
    appPath,
    'Contents',
    'Resources',
    'app',
    'node_modules',
    'libxulsword',
    'build',
    'Release',
  );
  const machos = [
    path.join(appPath, 'Contents', 'MacOS', productFilename),
    path.join(release, 'xulsword.node'),
    path.join(release, 'libxulsword-static.dylib'),
  ];
  if (MAC_SIGN_P12) machos.forEach((macho) => run(['verify', macho]));
  else {
    // rcodesign verify reports ad-hoc signatures as problems, since they
    // have no certificate. So just check that every Mach-O has a signature.
    machos.forEach((macho) => {
      const info = execFileSync(rcodesign, ['print-signature-info', macho], {
        encoding: 'utf8',
      });
      if (/^\s*signature: null/m.test(info))
        throw new Error(`Mach-O is missing its code signature: ${macho}`);
    });
    console.log('All libxulsword and app Mach-O binaries are ad-hoc signed.');
  }
}
