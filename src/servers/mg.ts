import type { GITypeMain, GType } from '../type.ts';

let GEither: GType | GITypeMain;
if (Build.isElectronApp) ({ default: GEither } = await import('./app/mg.ts'));
else ({ default: GEither } = await import('./webapp/mg.ts'));

export default GEither;
