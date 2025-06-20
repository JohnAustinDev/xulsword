/******************************************************************************
 *
 * canon_segond.h -	Versification data for French Louis Segond original
 *			and revised Bibles
 *
 * $Id$
 *
 * Copyright 1998-2013 CrossWire Bible Society (http://www.crosswire.org)
 *	CrossWire Bible Society
 *	P. O. Box 2528
 *	Tempe, AZ  85280-2528
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation version 2.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 */

#ifndef CANON_SEGOND_H
#define CANON_SEGOND_H

SWORD_NAMESPACE_START

// Versification system: Segond

// Book order: Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev

// Because different editions of the L. Segond Bibles employing this versification system differ subtly in versification, this is not based on any single edition, but on multiple editions of these Bibles.


/******************************************************************************
 * [on]tbooks_segond - initialize static instance for all canonical text names
 *		and chapmax
 *
 * for otbooks_segond, use otbooks
 *
 * for ntbooks_segond, use ntbooks
 *
 ******************************************************************************/

/******************************************************************************
 *	Maximum verses per chapter
 */

int vm_segond[] = {
  // Genesis
  31, 25, 24, 26, 32, 22, 24, 22, 29, 32,
  32, 20, 18, 24, 21, 16, 27, 33, 38, 18,
  34, 24, 20, 67, 34, 35, 46, 22, 35, 43,
  55, 32, 20, 31, 29, 43, 36, 30, 23, 23,
  57, 38, 34, 34, 28, 34, 31, 22, 33, 26,
  // Exodus
  22, 25, 22, 31, 23, 30, 29, 28, 35, 29,
  10, 51, 22, 31, 27, 36, 16, 27, 25, 26,
  36, 31, 33, 18, 40, 37, 21, 43, 46, 38,
  18, 35, 23, 35, 35, 38, 29, 31, 43, 38,
  // Leviticus
  17, 16, 17, 35, 26, 23, 38, 36, 24, 20,
  47, 8, 59, 57, 33, 34, 16, 30, 37, 27,
  24, 33, 44, 23, 55, 46, 34,
  // Numbers
  54, 34, 51, 49, 31, 27, 89, 26, 23, 36,
  35, 16, 33, 45, 41, 50, 13, 32, 22, 29,
  35, 41, 30, 25, 18, 65, 23, 31, 39, 17,
  54, 42, 56, 29, 34, 13,
  // Deuteronomy
  46, 37, 29, 49, 33, 25, 26, 20, 29, 22,
  32, 32, 18, 29, 23, 22, 20, 22, 21, 20,
  23, 30, 25, 22, 19, 19, 26, 68, 29, 20,
  30, 52, 29, 12,
  // Joshua
  18, 24, 17, 24, 15, 27, 26, 35, 27, 43,
  23, 24, 33, 15, 63, 10, 18, 28, 51, 9,
  45, 34, 16, 33,
  // Judges
  36, 23, 31, 24, 31, 40, 25, 35, 57, 18,
  40, 15, 25, 20, 20, 31, 13, 31, 30, 48,
  25,
  // Ruth
  22, 23, 18, 22,
  // I Samuel
  28, 36, 21, 22, 12, 21, 17, 22, 27, 27,
  15, 25, 23, 52, 35, 23, 58, 30, 24, 43,
  15, 23, 28, 23, 44, 25, 12, 25, 11, 31,
  13,
  // II Samuel
  27, 32, 39, 12, 25, 23, 29, 18, 13, 19,
  27, 31, 39, 33, 37, 23, 29, 33, 43, 26,
  22, 51, 39, 25,
  // I Kings
  53, 46, 28, 34, 18, 38, 51, 66, 28, 29,
  43, 33, 34, 31, 34, 34, 24, 46, 21, 43,
  29, 54,
  // II Kings
  18, 25, 27, 44, 27, 33, 20, 29, 37, 36,
  21, 21, 25, 29, 38, 20, 41, 37, 37, 21,
  26, 20, 37, 20, 30,
  // I Chronicles
  54, 55, 24, 43, 26, 81, 40, 40, 44, 14,
  47, 40, 14, 17, 29, 43, 27, 17, 19, 8,
  30, 19, 32, 31, 31, 32, 34, 21, 30,
  // II Chronicles
  17, 18, 17, 22, 14, 42, 22, 18, 31, 19,
  23, 16, 23, 14, 19, 14, 19, 34, 11, 37,
  20, 12, 21, 27, 28, 23, 9, 27, 36, 27,
  21, 33, 25, 33, 27, 23,
  // Ezra
  11, 70, 13, 24, 17, 22, 28, 36, 15, 44,
  // Nehemiah
  11, 20, 32, 23, 19, 19, 73, 18, 38, 39,
  36, 47, 31,
  // Esther
  22, 23, 15, 17, 14, 14, 10, 17, 32, 3,
  // Job
  22, 13, 26, 21, 27, 30, 21, 22, 35, 22,
  20, 25, 28, 22, 35, 22, 16, 21, 29, 29,
  34, 30, 17, 25, 6, 14, 23, 28, 25, 31,
  40, 22, 33, 37, 16, 33, 24, 38, 38, 28,
  25, 17,
  // Psalms
  6, 12, 9, 9, 13, 11, 18, 10, 21, 18,
  7, 9, 6, 7, 5, 11, 15, 51, 15, 10,
  14, 32, 6, 10, 22, 12, 14, 9, 11, 13,
  25, 11, 22, 23, 28, 13, 40, 23, 14, 18,
  14, 12, 5, 27, 18, 12, 10, 15, 21, 23,
  21, 11, 7, 9, 24, 14, 12, 12, 18, 14,
  9, 13, 12, 11, 14, 20, 8, 36, 37, 6,
  24, 20, 28, 23, 11, 13, 21, 72, 13, 20,
  17, 8, 19, 13, 14, 17, 7, 19, 53, 17,
  16, 16, 5, 23, 11, 13, 12, 9, 9, 5,
  8, 29, 22, 35, 45, 48, 43, 14, 31, 7,
  10, 10, 9, 8, 18, 19, 2, 29, 176, 7,
  8, 9, 4, 8, 5, 6, 5, 6, 8, 8,
  3, 18, 3, 3, 21, 26, 9, 8, 24, 14,
  10, 8, 12, 15, 21, 10, 20, 14, 9, 6,
  // Proverbs
  33, 22, 35, 27, 23, 35, 27, 36, 18, 32,
  31, 28, 25, 35, 33, 33, 28, 24, 29, 30,
  31, 29, 35, 34, 28, 28, 27, 28, 27, 33,
  31,
  // Ecclesiastes
  18, 26, 22, 17, 19, 12, 29, 17, 18, 20,
  8, 16,
  // Song of Solomon
  17, 17, 11, 16, 16, 12, 14, 14,
  // Isaiah
  31, 22, 26, 6, 30, 13, 25, 23, 20, 34,
  16, 6, 22, 32, 9, 14, 14, 7, 25, 6,
  17, 25, 18, 23, 12, 21, 13, 29, 24, 33,
  9, 20, 24, 17, 10, 22, 38, 22, 8, 31,
  29, 25, 28, 28, 25, 13, 15, 22, 26, 11,
  23, 15, 12, 17, 13, 12, 21, 14, 21, 22,
  11, 12, 19, 11, 25, 24,
  // Jeremiah
  19, 37, 25, 31, 31, 30, 34, 22, 26, 25,
  23, 17, 27, 22, 21, 21, 27, 23, 15, 18,
  14, 30, 40, 10, 38, 24, 22, 17, 32, 24,
  40, 44, 26, 22, 19, 32, 21, 28, 18, 16,
  18, 22, 13, 30, 5, 28, 7, 47, 39, 46,
  64, 34,
  // Lamentations
  22, 22, 66, 22, 22,
  // Ezekiel
  28, 10, 27, 17, 17, 14, 27, 18, 11, 22,
  25, 28, 23, 23, 8, 63, 24, 32, 14, 44,
  37, 31, 49, 27, 17, 21, 36, 26, 21, 26,
  18, 32, 33, 31, 15, 38, 28, 23, 29, 49,
  26, 20, 27, 31, 25, 24, 23, 35,
  // Daniel
  21, 49, 30, 37, 31, 28, 28, 27, 27, 21,
  45, 13,
  // Hosea
  9, 25, 5, 19, 15, 11, 16, 14, 17, 15,
  11, 15, 16, 9,
  // Joel
  20, 32, 21,
  // Amos
  15, 16, 15, 13, 27, 14, 17, 14, 15,
  // Obadiah
  21,
  // Jonah
  16, 11, 10, 11,
  // Micah
  16, 13, 12, 14, 14, 16, 20,
  // Nahum
  14, 14, 19,
  // Habakkuk
  17, 20, 19,
  // Zephaniah
  18, 15, 20,
  // Haggai
  15, 23,
  // Zechariah
  21, 13, 10, 14, 11, 15, 14, 23, 17, 12,
  17, 14, 9, 21,
  // Malachi
  14, 17, 18, 6,
  // -----------------------------------------------------------------
  // Matthew
  25, 23, 17, 25, 48, 34, 29, 34, 38, 42,
  30, 50, 58, 36, 39, 28, 27, 35, 30, 34,
  46, 46, 39, 51, 46, 75, 66, 20,
  // Mark
  45, 28, 35, 41, 43, 56, 37, 38, 51, 52,
  33, 44, 37, 72, 47, 20,
  // Luke
  80, 52, 38, 44, 39, 49, 50, 56, 62, 42,
  54, 59, 35, 35, 32, 31, 37, 43, 48, 47,
  38, 71, 56, 53,
  // John
  51, 25, 36, 54, 47, 71, 53, 59, 41, 42,
  57, 50, 38, 31, 27, 33, 26, 40, 42, 31,
  25,
  // Acts
  26, 47, 26, 37, 42, 15, 60, 40, 43, 48,
  30, 25, 52, 28, 41, 40, 34, 28, 40, 38,
  40, 30, 35, 27, 27, 32, 44, 31,
  // Romans
  32, 29, 31, 25, 21, 23, 25, 39, 33, 21,
  36, 21, 14, 23, 33, 27,
  // I Corinthians
  31, 16, 23, 21, 13, 20, 40, 13, 27, 33,
  34, 31, 13, 40, 58, 24,
  // II Corinthians
  24, 17, 18, 18, 21, 18, 16, 24, 15, 18,
  33, 21, 13,
  // Galatians
  24, 21, 29, 31, 26, 18,
  // Ephesians
  23, 22, 21, 32, 33, 24,
  // Philippians
  30, 30, 21, 23,
  // Colossians
  29, 23, 25, 18,
  // I Thessalonians
  10, 20, 13, 18, 28,
  // II Thessalonians
  12, 17, 18,
  // I Timothy
  20, 15, 16, 16, 25, 21,
  // II Timothy
  18, 26, 17, 22,
  // Titus
  16, 15, 15,
  // Philemon
  25,
  // Hebrews
  14, 18, 19, 16, 14, 20, 28, 13, 28, 39,
  40, 29, 25,
  // James
  27, 26, 18, 17, 20,
  // I Peter
  25, 25, 22, 19, 14,
  // II Peter
  21, 22, 18,
  // I John
  10, 29, 24, 21, 21,
  // II John
  13,
  // III John
  15,
  // Jude
  25,
  // Revelation of John
  20, 29, 22, 11, 14, 17, 17, 13, 21, 11,
  19, 18, 18, 20, 8, 21, 18, 24, 21, 15,
  27, 21
};



unsigned char mappings_segond[] = {
    0,
    2,   7,   26,  0,   8,   1,   0,
    2,   8,   1,   0,   8,   5,   0,
    3,   5,   20,  0,   6,   1,   0,
    3,   6,   1,   0,   6,   8,   0,
    4,   30,  1,   0,   29,  40,  0,
    4,   30,  2,   0,   30,  1,   0,
    9,   20,  43,  0,   20,  42,  0,
    9,   24,  1,   0,   23,  29,  0,
    9,   24,  2,   0,   24,  1,   0,
    11,  22,  44,  0,   22,  43,  0,
    14,  13,  23,  0,   14,  1,   0,
    14,  14,  1,   0,   14,  2,   0,
    18,  39,  1,   0,   38,  39,  0,
    18,  39,  4,   0,   39,  1,   0,
    18,  39,  34,  0,   40,  1,   0,
    18,  40,  1,   0,   40,  6,   0,
    18,  40,  20,  0,   41,  1,   0,
    18,  41,  1,   0,   41,  10,  0,
    19,  3,   2,   0,   3,   1,   0,
    19,  4,   2,   0,   4,   1,   0,
    19,  5,   2,   0,   5,   1,   0,
    19,  6,   2,   0,   6,   1,   0,
    19,  7,   2,   0,   7,   1,   0,
    19,  8,   2,   0,   8,   1,   0,
    19,  9,   2,   0,   9,   1,   0,
    19,  12,  2,   0,   12,  1,   0,
    19,  18,  2,   0,   18,  1,   0,
    19,  19,  2,   0,   19,  1,   0,
    19,  20,  2,   0,   20,  1,   0,
    19,  21,  2,   0,   21,  1,   0,
    19,  22,  2,   0,   22,  1,   0,
    19,  30,  2,   0,   30,  1,   0,
    19,  31,  2,   0,   31,  1,   0,
    19,  34,  2,   0,   34,  1,   0,
    19,  36,  2,   0,   36,  1,   0,
    19,  38,  2,   0,   38,  1,   0,
    19,  39,  2,   0,   39,  1,   0,
    19,  40,  2,   0,   40,  1,   0,
    19,  41,  2,   0,   41,  1,   0,
    19,  42,  2,   0,   42,  1,   0,
    19,  44,  2,   0,   44,  1,   0,
    19,  45,  2,   0,   45,  1,   0,
    19,  46,  2,   0,   46,  1,   0,
    19,  47,  2,   0,   47,  1,   0,
    19,  48,  2,   0,   48,  1,   0,
    19,  49,  2,   0,   49,  1,   0,
    19,  51,  2,   0,   51,  1,   0,
    19,  51,  3,   0,   51,  1,   0,
    19,  52,  2,   0,   52,  1,   0,
    19,  52,  3,   0,   52,  1,   0,
    19,  53,  2,   0,   53,  1,   0,
    19,  54,  3,   0,   54,  1,   0,
    19,  55,  2,   0,   55,  1,   0,
    19,  56,  2,   0,   56,  1,   0,
    19,  57,  2,   0,   57,  1,   0,
    19,  58,  2,   0,   58,  1,   0,
    19,  59,  2,   0,   59,  1,   0,
    19,  60,  2,   0,   60,  1,   0,
    19,  60,  3,   0,   60,  1,   0,
    19,  61,  2,   0,   61,  1,   0,
    19,  62,  2,   0,   62,  1,   0,
    19,  63,  2,   0,   63,  1,   0,
    19,  64,  2,   0,   64,  1,   0,
    19,  65,  2,   0,   65,  1,   0,
    19,  67,  2,   0,   67,  1,   0,
    19,  68,  2,   0,   68,  1,   0,
    19,  69,  2,   0,   69,  1,   0,
    19,  70,  2,   0,   70,  1,   0,
    19,  75,  2,   0,   75,  1,   0,
    19,  76,  2,   0,   76,  1,   0,
    19,  77,  2,   0,   77,  1,   0,
    19,  80,  2,   0,   80,  1,   0,
    19,  81,  2,   0,   81,  1,   0,
    19,  83,  2,   0,   83,  1,   0,
    19,  84,  2,   0,   84,  1,   0,
    19,  85,  2,   0,   85,  1,   0,
    19,  88,  2,   0,   88,  1,   0,
    19,  89,  2,   0,   89,  1,   0,
    19,  92,  2,   0,   92,  1,   0,
    19,  102, 2,   0,   102, 1,   0,
    19,  108, 2,   0,   108, 1,   0,
    19,  140, 2,   0,   140, 1,   0,
    19,  142, 2,   0,   142, 1,   0,
    21,  4,   17,  0,   5,   1,   0,
    21,  5,   1,   0,   5,   2,   0,
    21,  12,  1,   0,   11,  9,   0,
    21,  12,  3,   0,   12,  1,   0,
    22,  7,   1,   0,   6,   13,  0,
    22,  7,   2,   0,   7,   1,   0,
    23,  8,   23,  0,   9,   1,   0,
    23,  9,   1,   0,   9,   2,   0,
    23,  63,  19,  0,   64,  1,   0,
    23,  64,  2,   0,   64,  3,   0,
    26,  21,  1,   0,   20,  45,  0,
    26,  21,  6,   0,   21,  1,   0,
    28,  2,   1,   0,   1,   10,  0,
    28,  2,   3,   0,   2,   1,   0,
    28,  12,  1,   0,   11,  12,  0,
    28,  12,  2,   0,   12,  1,   0,
    32,  2,   1,   0,   1,   17,  0,
    32,  2,   2,   0,   2,   1,   0,
    33,  4,   14,  0,   5,   1,   0,
    33,  5,   1,   0,   5,   2,   0,
    34,  2,   1,   0,   1,   15,  0,
    34,  2,   2,   0,   2,   1,   0,
    41,  9,   51,  0,   9,   50,  0,
    44,  19,  40,  0,   19,  41,  0,
    47,  13,  12,  0,   13,  13,  0,
    64,  1,   15,  0,   1,   14,  0,
    66,  12,  18,  0,   13,  1,   0,
    0
};
SWORD_NAMESPACE_END

#endif
