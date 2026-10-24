/*global process, Buffer */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

// electron-builder can only sign MacOS apps on MacOS. When packaging the
// MacOS app on Linux, this signs it with rcodesign instead, and also
// notarizes it when credentials are set. It must run from afterPack, because
// electron-builder skips the afterSign hook when it did not sign.
//
// Environment variables (see setenv):
//   MAC_SIGN_P12                 Developer ID Application certificate (.p12)
//   MAC_SIGN_P12_PASSWORD_FILE   File containing the .p12 password
//   MAC_NOTARY_API_KEY           App Store Connect API key JSON file, made with
//                                rcodesign encode-app-store-connect-api-key
// Without MAC_SIGN_P12 the app is only ad-hoc signed.

const RCODESIGN_VERSION = '0.29.0';
const RCODESIGN_SHA256 = {
  x86_64: 'dbe85cedd8ee4217b64e9a0e4c2aef92ab8bcaaa41f20bde99781ff02e600002',
  aarch64: '4af92c87ddf52f5f2d1258a3b4e56c7dcb8f1b2468df744976c5f139e031961f',
};

// Return the path of rcodesign. If it is not in Cpp/darwin-bin or on the
// PATH, the Linux release is downloaded (to xulsword/archive) and installed
// to Cpp/darwin-bin.
async function getRcodesign(projectDir) {
  const darwinBin = path.join(projectDir, 'Cpp', 'darwin-bin');
  const local = path.join(darwinBin, 'rcodesign');
  if (fs.existsSync(local)) return local;
  try {
    execFileSync('rcodesign', ['--version'], { stdio: 'ignore' });
    return 'rcodesign';
  } catch {
    // Not on the PATH, so download it.
  }

  const arch = { x64: 'x86_64', arm64: 'aarch64' }[process.arch];
  if (process.platform !== 'linux' || !arch)
    throw new Error(
      `Install rcodesign to ${darwinBin} to sign the MacOS app on ${process.platform}-${process.arch}.`,
    );
  const name = `apple-codesign-${RCODESIGN_VERSION}-${arch}-unknown-linux-musl`;
  const archiveDir = path.join(projectDir, 'archive');
  const tarball = path.join(archiveDir, `${name}.tar.gz`);
  if (!fs.existsSync(tarball)) {
    const url = `https://github.com/indygreg/apple-platform-rs/releases/download/apple-codesign/${RCODESIGN_VERSION}/${name}.tar.gz`;
    console.log(`Downloading ${url}`);
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Could not download ${url}: ${response.status}`);
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.writeFileSync(tarball, Buffer.from(await response.arrayBuffer()));
  }
  const sha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(tarball))
    .digest('hex');
  if (sha256 !== RCODESIGN_SHA256[arch])
    throw new Error(`${tarball} has the wrong checksum.`);
  fs.mkdirSync(darwinBin, { recursive: true });
  execFileSync('tar', [
    '-xzf',
    tarball,
    '-C',
    darwinBin,
    '--strip-components=1',
    `${name}/rcodesign`,
  ]);
  return local;
}

export default async function macSign(context) {
  const { appOutDir, packager } = context;
  const { projectDir } = packager;
  const { productFilename } = packager.appInfo;
  const appPath = path.join(appOutDir, `${productFilename}.app`);

  const rcodesign = await getRcodesign(projectDir);
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
    path.join(release, 'libxulsword.node'),
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
