#!/usr/bin/perl
# Usage: createLanguageNames.pl [path/to/Language_Code_Data_YYYYMMDD.zip]
#
# Recreates assets/locales/languageNames.json, which maps language codes to
# language names:
#
#   en:   The English name of each living language (LangStatus L) in
#         Ethnologue's LanguageCodes.tab, keyed by its ISO 639-3 code. Each
#         language with an ISO 639-1 two letter code (from SIL's
#         iso-639-3.tab) is also listed under that code. Macrolanguages like
#         'uz' and 'fa', and a few others like 'nb', are not in Ethnologue,
#         so their name comes from iso-639-3.tab.
#   self: The language's name for itself, from the CLDR locale data in
#         DateTime::Locale. The locale of the language's primary country
#         (from LanguageCodes.tab) is tried first.
#   ru:   The Russian name of each language, from CLDR's localenames data.
#         Other languages can be added to @NAMES.
#
# Names from IBT's language manifest then replace the names above. It has
# English, Russian and local names of many languages of Russia and Central
# Asia. It also uses some codes of its own, like 'kr2' (Balkar).
#
# Finally, the names in %SPECIAL replace all others.
#
# Sources (Ethnologue's terms of use require citing SIL as the source):
#   Ethnologue, SIL Global: https://www.ethnologue.com/codes/
#   ISO 639-3, SIL International: https://iso639-3.sil.org/
#   Unicode CLDR, via the DateTime::Locale Perl module and
#   https://github.com/unicode-org/cldr-json
#   Institute for Bible Translation (IBT):
#   https://ibtrussia.org/sites/default/files/language_manifest.json
#
# The downloads are saved in a temporary directory and reused by later runs.
# Ethnologue's site may block scripted downloads with a browser check. If so,
# download the zip in a browser and either pass its path as the argument or
# copy it into the temporary directory.

use strict;
use warnings;
use utf8;
use File::Spec;
use File::Path qw(make_path);
use File::Copy qw(copy);
use FindBin qw($Bin);
use Cwd qw(abs_path);
use HTTP::Tiny;
use JSON::PP;
use DateTime::Locale;

my $DATA   = 'Language_Code_Data_20260217';
my $URL    = "https://www.ethnologue.com/codes/$DATA.zip";
my $ISOURL = 'https://iso639-3.sil.org/sites/iso639-3/files/downloads/iso-639-3.tab';
my $IBTURL = 'https://ibtrussia.org/sites/default/files/language_manifest.json';
my $CLDR   = '49.0.0';
my @NAMES  = ('ru'); # also list language names in these languages

# Names that replace those from all sources: map => { code => name }.
my %SPECIAL = (
  ru => {
    hbo => 'древнееврейский язык', # Ancient Hebrew
  },
);
my $OUT    = File::Spec->catfile(abs_path("$Bin/.."), 'assets', 'locales', 'languageNames.json');

binmode(STDOUT, ':encoding(UTF-8)');
binmode(STDERR, ':encoding(UTF-8)');

my $tmp = File::Spec->catdir(File::Spec->tmpdir(), 'xulsword-languageNames');
my $dir = File::Spec->catdir($tmp, $DATA);
my $zip = File::Spec->catfile($tmp, "$DATA.zip");
make_path($tmp);

my $codesFile = File::Spec->catfile($dir, 'LanguageCodes.tab');
my $isoFile   = File::Spec->catfile($tmp, 'iso-639-3.tab');

if (!-e $codesFile) {
  if (@ARGV) {
    my $arg = shift @ARGV;
    copy($arg, $zip) || die "Could not copy $arg to $zip: $!\n";
  }
  if (!-e $zip) {
    print "Downloading $URL\n";
    my $res = HTTP::Tiny->new->mirror($URL, $zip);
    if (!$res->{success}) {
      unlink $zip;
      &downloadFailed("HTTP $res->{status} $res->{reason}");
    }
  }
  if (!&isZip($zip)) {
    unlink $zip;
    &downloadFailed('the server did not return a zip file');
  }
  system('unzip', '-o', '-q', $zip, '-d', $tmp) == 0
    || die "Could not unzip $zip\n";
  die "Missing $codesFile after unzip.\n" if !-e $codesFile;
}

&download($ISOURL, $isoFile);

# Language names in each language of @NAMES, keyed by CLDR code.
my %names;
foreach my $lang (@NAMES) {
  my $file = File::Spec->catfile($tmp, "cldr-$CLDR-$lang-languages.json");
  &download("https://raw.githubusercontent.com/unicode-org/cldr-json/$CLDR/"
    . "cldr-json/cldr-localenames-full/main/$lang/languages.json", $file);
  my $data = &readJSON($file);
  $names{$lang} = $data->{main}{$lang}{localeDisplayNames}{languages}
    || die "No language names in $file\n";
}

# English names and primary country of each living language.
my (%en, %country);
foreach my $r (&readTab($codesFile)) {
  next if $r->{LangStatus} ne 'L';
  $en{$r->{LangID}}      = $r->{Name};
  $country{$r->{LangID}} = $r->{CountryID};
}

# Add the two letter codes. %cldr is the code CLDR uses for each language,
# which is the two letter code when there is one.
my %cldr = map { $_ => $_ } keys %en;
my %part1;
foreach my $r (&readTab($isoFile)) {
  my ($id, $part1) = ($r->{Id}, $r->{Part1});
  $part1{$id} = $part1 if $part1;
  next if !$part1 && $r->{Scope} ne 'M';
  if (!exists $en{$id}) {
    ($en{$id} = $r->{Ref_Name}) =~ s/\s*\(macrolanguage\)$//;
    $cldr{$id} = $id;
  }
  next if !$part1;
  $en{$part1} = $en{$id};
  $country{$part1} = $country{$id} if exists $country{$id};
  $cldr{$id} = $cldr{$part1} = $part1;
}

# Local names from CLDR.
my (%self, %locale);
foreach my $code (keys %en) {
  my $c = $cldr{$code};
  if (!exists $locale{$c}) {
    $locale{$c} = undef;
    foreach my $try ($country{$code} ? ("$c-$country{$code}") : (), $c) {
      my $l = eval { DateTime::Locale->load($try) };
      if ($l && $l->language_code eq $c && $l->native_language) {
        $locale{$c} = $l->native_language;
        last;
      }
    }
  }
  $self{$code} = $locale{$c} if defined $locale{$c};
}

# Names in other languages from CLDR.
my %other;
foreach my $lang (@NAMES) {
  $other{$lang} = {};
  foreach my $code (keys %en) {
    my $name = $names{$lang}{$cldr{$code}};
    $other{$lang}{$code} = $name if defined $name;
  }
}

# Replace names with those of IBT's language manifest. Its keys are like
# 'abk:2579'. Languages with no ISO code, like macrolanguages, have keys like
# ':2573' and are skipped.
my $ibtFile = File::Spec->catfile($tmp, 'language_manifest.json');
&download($IBTURL, $ibtFile);
my $ibt = &readJSON($ibtFile);
foreach my $key (sort keys %$ibt) {
  my $r  = $ibt->{$key};
  my $id = $key =~ s/:.*$//r;
  next if $id eq '';
  my %maps = (en => \%en, self => \%self);
  my %fields = (en => 'name_en', self => 'name_local');
  if (exists $other{ru}) {
    $maps{ru}   = $other{ru};
    $fields{ru} = 'name_ru';
  }
  foreach my $m (keys %maps) {
    my $name = $r->{$fields{$m}} // '';
    $name =~ s/\s*\r?\n\s*/ \/ /g; # local names in several scripts
    $name =~ s/^\s+|\s+$//g;
    next if $name eq '';
    foreach my $code ($id, $part1{$id} || ()) {
      $maps{$m}{$code} = $name;
    }
  }
}

my @maps = (['en', \%en], ['self', \%self], map { [$_, $other{$_}] } @NAMES);

foreach my $m (@maps) {
  my ($name, $map) = @$m;
  my $special = $SPECIAL{$name} || next;
  $map->{$_} = $special->{$_} foreach keys %$special;
}
foreach my $name (keys %SPECIAL) {
  die "Unknown map '$name' in %SPECIAL\n" if !grep { $_->[0] eq $name } @maps;
}
open(my $fh, '>:encoding(UTF-8)', $OUT) || die "Could not open $OUT: $!\n";
print $fh "{\n" . join(",\n", map { &jsonMap(@$_) } @maps) . "\n}\n";
close($fh);

printf "Wrote %s (%s)\n", $OUT,
  join(', ', map { "$_->[0]: " . scalar(keys %{$_->[1]}) } @maps);

# Download url to file, unless file already exists.
sub download {
  my ($url, $file) = @_;
  return if -e $file;
  print "Downloading $url\n";
  my $res = HTTP::Tiny->new->mirror($url, $file);
  if (!$res->{success}) {
    unlink $file;
    die "Could not download $url (HTTP $res->{status} $res->{reason}).\n";
  }
}

sub readJSON {
  my $file = shift;
  open(my $in, '<:raw', $file) || die "Could not open $file: $!\n";
  my $data = decode_json(do { local $/; <$in> });
  close($in);
  return $data;
}

# Return the rows of a tab separated file with a header line, as hashes.
sub readTab {
  my $file = shift;
  open(my $in, '<:encoding(UTF-8)', $file) || die "Could not open $file: $!\n";
  my $header = <$in>;
  $header =~ s/^\x{FEFF}//;
  $header =~ s/\r?\n$//;
  my @cols = split(/\t/, $header);
  my @rows;
  while (my $line = <$in>) {
    $line =~ s/\r?\n$//;
    next if $line eq '';
    my %r;
    @r{@cols} = split(/\t/, $line, -1);
    push(@rows, \%r);
  }
  close($in);
  return @rows;
}

# Return a JSON object member, tab indented, with keys sorted.
sub jsonMap {
  my ($name, $map) = @_;
  my $json = JSON::PP->new->allow_nonref;
  my @lines = map { "\t\t" . $json->encode($_) . ': ' . $json->encode($map->{$_}) }
    sort keys %$map;
  return "\t\"$name\": {\n" . join(",\n", @lines) . "\n\t}";
}

sub isZip {
  my $file = shift;
  open(my $in, '<:raw', $file) || return 0;
  read($in, my $magic, 2);
  close($in);
  return defined($magic) && $magic eq 'PK';
}

sub downloadFailed {
  my $why = shift;
  die "Could not download $URL ($why).\n"
    . "Download it in a browser, then run:\n"
    . "  $0 path/to/$DATA.zip\n"
    . "or copy it to $zip\n";
}
