import log from 'electron-log';
import LocalFile from './components/localFile.ts';

// Extract and return a font file's internal fontFamily name.
export default function getFontFamily(fontpath: string) {
  const fontfile = new LocalFile(fontpath);
  const buff = fontfile.readBuf();
  if (!buff) return null;

  let index = 0;
  const read8 = (): number | null => {
    if (index === buff.byteLength) {
      return null;
    }
    const byte = buff[index];
    index += 1;
    return byte;
  };

  // decimal to character
  const chr = (val: number): string => {
    return String.fromCharCode(val);
  };

  // unsigned short to decimal
  const ushort = (b1: number, b2: number): number => {
    return 256 * b1 + b2;
  };

  // unsigned long to decimal
  const ulong = (b1: number, b2: number, b3: number, b4: number): number => {
    return 16777216 * b1 + 65536 * b2 + 256 * b3 + b4;
  };

  // we know about TTF (0x00010000) and CFF ('OTTO') fonts
  const ttf = chr(0) + chr(1) + chr(0) + chr(0);
  const cff = 'OTTO';

  const data: number[] = [];
  for (let b = 0; b < 6; b += 1) {
    const data8 = read8();
    if (data8 !== null) data.push(data8);
    else break;
  }

  // so what kind of font is this?
  let format;
  const version = chr(data[0]) + chr(data[1]) + chr(data[2]) + chr(data[3]);
  const isTTF = version === ttf;
  const isCFF = isTTF ? false : version === cff;
  if (isTTF) {
    format = 'truetype';
  } else if (isCFF) {
    format = 'opentype';
  } else {
    log.warn(`"${fontpath}" cannot be interpreted as OpenType font.`);
    return null;
  }

  // parse the SFNT header data
  const numTables = ushort(data[4], data[5]);
  const tagStart = 12;
  let ptr;
  const end = tagStart + 16 * numTables;
  const tags = {} as Record<
    string,
    {
      name: string;
      checksum: number;
      offset: number;
      length: number;
    }
  >;
  let tag;

  for (let b = 6; b < end + 16; b += 1) {
    const data8 = read8();
    if (data8 !== null) data.push(data8);
    else break;
  }

  for (ptr = tagStart; ptr < end; ptr += 16) {
    tag =
      chr(data[ptr]) +
      chr(data[ptr + 1]) +
      chr(data[ptr + 2]) +
      chr(data[ptr + 3]);
    tags[tag] = {
      name: tag,
      checksum: ulong(
        data[ptr + 4],
        data[ptr + 5],
        data[ptr + 6],
        data[ptr + 7],
      ),
      offset: ulong(
        data[ptr + 8],
        data[ptr + 9],
        data[ptr + 10],
        data[ptr + 11],
      ),
      length: ulong(
        data[ptr + 12],
        data[ptr + 13],
        data[ptr + 14],
        data[ptr + 15],
      ),
    };
  }

  // read the Naming Table
  tag = 'name';
  if (!tags[tag]) {
    log.warn(`"${fontpath}" is missing the required OpenType ${tag} table.`);
    return null;
  }
  ptr = tags[tag].offset;

  for (let b = end + 16; b < ptr + 6; b += 1) {
    const data8 = read8();
    if (data8 !== null) data.push(data8);
    else break;
  }

  const nameTable = {
    format: ushort(data[ptr], data[ptr + 1]),
    count: ushort(data[ptr + 2], data[ptr + 3]),
    stringOffset: ushort(data[ptr + 4], data[ptr + 5]),
    nameRecordOffset: 6,
  };

  const r1ptr = ptr + nameTable.nameRecordOffset;

  for (let b = ptr + 6; b < r1ptr + 13 * nameTable.count; b += 1) {
    const data8 = read8();
    if (data8 !== null) data.push(data8);
    else break;
  }

  let aString;
  for (let nrptr = r1ptr; nrptr < r1ptr + 12 * nameTable.count; nrptr += 12) {
    aString = {
      platformID: ushort(data[nrptr], data[nrptr + 1]),
      encodingID: ushort(data[nrptr + 2], data[nrptr + 3]),
      languageID: ushort(data[nrptr + 4], data[nrptr + 5]),
      nameID: ushort(data[nrptr + 6], data[nrptr + 7]),
      length: ushort(data[nrptr + 8], data[nrptr + 9]),
      offset: ushort(data[nrptr + 10], data[nrptr + 11]),
    };
    if (aString.nameID === 1) break; // fontFamily
  }
  if (!aString || aString.nameID !== 1) {
    log.warn(
      `"${fontpath}" is missing the required OpenType fontFamily string.`,
    );
    return null;
  }

  // read the familyName string
  let familyName = null;
  const s: number = ptr + nameTable.stringOffset + aString.offset;
  const e: number = s + aString.length;

  for (let b = r1ptr + 13 * nameTable.count; b < s + aString.length; b += 1) {
    const data8 = read8();
    if (data8 !== null) data.push(data8);
    else break;
  }

  const u8 = data.slice(s, e);
  switch (aString.platformID) {
    case 0: {
      // Unicode (just assume utf16?)let
      const u16 = [];
      for (let i = 0; i < u8.length; i += 2) {
        u16.push(ushort(u8[i], u8[i + 1]));
      }
      familyName = String.fromCharCode.apply(null, u16);
      break;
    }
    case 1: // Macintosh
      familyName = String.fromCharCode.apply(null, u8);
      break;
    case 2: // ISO [deprecated]
    case 3: // Windows
    case 4: // Custom
    default: {
      log.warn(
        `"${fontpath}: ${format}" font string's platform decoding is not implemented, assuming utf16.`,
      );
      const u16 = [];
      for (let i = 0; i < u8.length; i += 2) {
        u16.push(ushort(u8[i], u8[i + 1]));
      }
      familyName = String.fromCharCode.apply(null, u16);
    }
  }

  if (familyName) {
    log.verbose(`Read font ${familyName}: ${fontpath}`);
  }
  return familyName;
}
