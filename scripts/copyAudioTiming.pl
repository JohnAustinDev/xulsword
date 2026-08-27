#!/usr/bin/perl

use strict;
use File::Basename;
use File::Path qw(make_path);
use HTML::Entities qw(decode_entities);

# Copies SIL/Aeneas audio timing text files from a source directory into a
# xulsword audio module directory, reconciling each timing file with its
# corresponding audio file and renaming it to match.
#
# Timing files are expected to be named like: 19-PSA-119-timing.txt
# where PSA is the Paratext book abbreviation and 119 is the chapter number.
#
# The xulsword audio module directory contains one sub-directory per Bible
# book, named with the book's OSIS abbreviation (eg. Ps, 1Cor), and each of
# those contains one audio file per chapter (eg. 119.mp3, or 0119.mp3). A
# timing file is copied next to the audio file it belongs to and renamed to
# share that audio file's name, but with a ".txt" extension. A configuration
# string, which is the same for every file, is inserted as the first line(s)
# of each copied timing file.
#
# Usage:
#   copyAudioTiming.pl <timingSourceDir> <audioModuleDir> <configString>
#
# If <configString> begins with '@', the rest is treated as a path to a file
# whose contents are used as the configuration string (useful for multi-line
# configurations). Otherwise any "\n" sequences in <configString> are turned
# into actual newlines. Either way, any HTML entities (eg. "&amp;", "&#233;")
# found in the configuration string are replaced with their literal Unicode
# characters.
#
# If a timing file's OSIS book sub-directory does not already exist in the
# audio module directory, it is created. If no audio file for the timing
# file's chapter can be found (whether or not the book directory already
# existed), the timing file is still copied in, named with a 3 digit
# zero-padded chapter number (eg. 003.txt).

my $TimingDir = shift;
my $AudioModuleDir = shift;
my $ConfigArg = shift || '\separators &#x200B;';

if (!defined($TimingDir) || !defined($AudioModuleDir) || !defined($ConfigArg) || !length($ConfigArg)) {
  die "usage: $0 <timingSourceDir> <audioModuleDir> [<configString|\@configFile>|\\separators &#x200B;]\n";
}
$TimingDir =~ s/\/+$//;
$AudioModuleDir =~ s/\/+$//;

die "ERROR: Not a directory: $TimingDir\n" if !-d $TimingDir;
die "ERROR: Not a directory: $AudioModuleDir\n" if !-d $AudioModuleDir;

my $Config = &readConfig($ConfigArg);

# Maps Paratext/USFM Bible book abbreviations to xulsword OSIS book
# abbreviations (from src/constant.ts SupportedBooks). Extend this table if
# other (eg. deuterocanonical) books need to be supported.
my %ParaToOsis = (
  'GEN' => 'Gen',     'EXO' => 'Exod',    'LEV' => 'Lev',     'NUM' => 'Num',
  'DEU' => 'Deut',    'JOS' => 'Josh',    'JDG' => 'Judg',    'RUT' => 'Ruth',
  '1SA' => '1Sam',    '2SA' => '2Sam',    '1KI' => '1Kgs',    '2KI' => '2Kgs',
  '1CH' => '1Chr',    '2CH' => '2Chr',    'EZR' => 'Ezra',    'NEH' => 'Neh',
  'EST' => 'Esth',    'JOB' => 'Job',     'PSA' => 'Ps',      'PRO' => 'Prov',
  'ECC' => 'Eccl',    'SNG' => 'Song',    'ISA' => 'Isa',     'JER' => 'Jer',
  'LAM' => 'Lam',     'EZK' => 'Ezek',    'DAN' => 'Dan',     'HOS' => 'Hos',
  'JOL' => 'Joel',    'AMO' => 'Amos',    'OBA' => 'Obad',    'JON' => 'Jonah',
  'MIC' => 'Mic',     'NAM' => 'Nah',     'HAB' => 'Hab',     'ZEP' => 'Zeph',
  'HAG' => 'Hag',     'ZEC' => 'Zech',    'MAL' => 'Mal',

  'MAT' => 'Matt',    'MRK' => 'Mark',    'LUK' => 'Luke',    'JHN' => 'John',
  'ACT' => 'Acts',    'ROM' => 'Rom',     '1CO' => '1Cor',    '2CO' => '2Cor',
  'GAL' => 'Gal',     'EPH' => 'Eph',     'PHP' => 'Phil',    'COL' => 'Col',
  '1TH' => '1Thess',  '2TH' => '2Thess',  '1TI' => '1Tim',    '2TI' => '2Tim',
  'TIT' => 'Titus',   'PHM' => 'Phlm',    'HEB' => 'Heb',     'JAS' => 'Jas',
  '1PE' => '1Pet',    '2PE' => '2Pet',    '1JN' => '1John',   '2JN' => '2John',
  '3JN' => '3John',   'JUD' => 'Jude',    'REV' => 'Rev',
);

# Audio file extensions that a timing file may be reconciled against.
my @AudioExtensions = qw(mp3 m4a m4b aac ogg oga opus wav flac wma);

opendir(TD, $TimingDir) || die "ERROR: Could not open $TimingDir\n";
my @timingFiles = sort readdir(TD);
closedir(TD);

my ($copied, $skipped) = (0, 0);

foreach my $file (@timingFiles) {
  next if $file =~ /^\./;
  next if !-f "$TimingDir/$file";

  if ($file !~ /^\d+[_-]([A-Za-z0-9]+)-(\d+)-timing\.txt$/i) {
    print "WARNING: Skipping file with unrecognized name: $file\n";
    $skipped++;
    next;
  }
  my $paraAbbr = uc($1);
  my $chapter = $2 + 0;

  my $osisAbbr = $ParaToOsis{$paraAbbr};
  if (!$osisAbbr) {
    print "WARNING: Skipping $file (unrecognized Paratext book abbreviation: $paraAbbr)\n";
    $skipped++;
    next;
  }

  my $bookDir = "$AudioModuleDir/$osisAbbr";
  if (!-d $bookDir) {
    print "INFO: Creating book directory: $bookDir\n";
    make_path($bookDir) || die "ERROR: Could not create $bookDir\n";
  }

  my $audioFile = &findAudioFile($bookDir, $chapter);
  my $audioName;
  if ($audioFile) {
    ($audioName) = fileparse($audioFile, qr/\.[^.]*/);
  } else {
    $audioName = sprintf('%03d', $chapter);
    #print "WARNING: No audio file found for chapter $chapter in $bookDir; " .
    #  "copying timing file as $audioName.txt anyway\n";
  }
  my $destFile = "$bookDir/$audioName.txt";

  if (-e $destFile) {
    print "INFO: Overwriting existing timing file: $destFile\n";
  }

  open(SRC, "<:encoding(UTF-8)", "$TimingDir/$file") || die "$TimingDir/$file";
  my $content = join('', <SRC>);
  close(SRC);

  open(DEST, ">:encoding(UTF-8)", $destFile) || die $destFile;
  print DEST $Config;
  print DEST $content;
  close(DEST);

  print "INFO: Copied $file -> $destFile\n";
  $copied++;
}

print "\nDone. Copied $copied timing file(s), skipped $skipped.\n";

###############################################################################
###############################################################################

# Reads the configuration string, either literally (with "\n" escapes turned
# into newlines) or from a file if it was given as "\@path/to/file".
sub readConfig {
  my $arg = shift;

  my $config;
  if ($arg =~ /^\@(.+)$/) {
    my $configFile = $1;
    open(CF, "<:encoding(UTF-8)", $configFile) || die "$configFile\n";
    $config = join('', <CF>);
    close(CF);
  } else {
    $config = $arg;
    $config =~ s/\\n/\n/g;
  }
  $config = decode_entities($config);
  $config .= "\n" if $config !~ /\n$/;

  return $config;
}

# Finds the file in dir whose name begins with the given chapter number
# (allowing for leading zeros) and has a known audio file extension. Returns
# the matching file's leaf name, or undef if none (or more than one) is found.
sub findAudioFile {
  my $dir = shift;
  my $chapter = shift;

  my $extRE = join('|', @AudioExtensions);

  opendir(BD, $dir) || die "ERROR: Could not open $dir\n";
  my @entries = readdir(BD);
  closedir(BD);

  my @matches;
  foreach my $entry (@entries) {
    next if -d "$dir/$entry";
    next if $entry !~ /^0*(\d+)\.($extRE)$/i;
    push(@matches, $entry) if $1 + 0 == $chapter;
  }

  if (@matches > 1) {
    print "WARNING: Multiple audio files match chapter $chapter in $dir: " .
      join(', ', @matches) . " (using $matches[0])\n";
  }

  return $matches[0];
}
