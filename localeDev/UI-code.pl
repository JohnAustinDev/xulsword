#!/usr/bin/perl
use File::Spec;
$NOCONSOLELOG = 1;

if (!@ARGV) {
  print "Creates a xulsword locale from UI text files and Firefox files.\n";
  print "\n";
  print "usage: UI-code.pl MK MKS xulswordLocale\n"; 
  print "\n";
  print "MK is the path to xulsword svn\n";
  print "\n";
  print "MKS is the path to a xulsword extras directory. This directory\n";
  print "  should contain the following files needed to build a new locale:\n";
  print "  <MKS-top-directory>\n";
  print "  ---->  localeDev\n";
  print "         ----> Firefox17 (where 17 is Firefox version number)\n";
  print "               ----> <locale-code1> (a Firefox 17 locale)\n";
  print "               ----> <locale-code2> (another Firefox 17 locale)\n";
  print "         ----> <locale-code1> (a xulsword locale)\n";
  print "               ----> UI-<locale-code1>.txt\n";
  print "               ----> UI-<locale-code1>_2.txt\n";
  print "               ----> skin-files (contains any xulsword skin files)\n";
  print "               ----> locale-files (contains xulsword locale files)\n";
  print "               ----> <locale-code1>.rdf (contains localized bookmarks)\n";
  print "         ----> <locale-code2> (another xulsword locale)\n";
  print "\n";
  print "xulswordLocale is the ISO code of the xulsword locale to create\n";
  print "\n";
  exit;
}

$MK = shift;
$MKS = shift;
$LOCALE = shift;

$MK  =~ s/\\/\//g;
$MKS =~ s/\\/\//g;
if ($MK  =~ /^\s*\./) {$MK  = File::Spec->rel2abs($MK);}
if ($MKS =~ /^\s*\./) {$MKS = File::Spec->rel2abs($MKS);}
$MK  =~ s/\/\s*$//;
$MKS =~ s/\/\s*$//;

require "$MK/localeDev/script/UI-common.pl";

$LOGFILE = "$LOCALEDIR/code_log.txt";
if (-e $LOGFILE) {unlink($LOGFILE);}

if (!-e $LOCALEDIR) {&Log("ERROR: Locale \"$LOCALEDIR\" was not found"); die;}
if (-e $LOCALECODE) {remove_tree($LOCALECODE);}

&Log($LOCINFO);

# read UI file(s).
&read_UI_Files($LOCALE, \%UIDescValue);

# read the MAP contents into memory
&readMAP($MAPFILE, \%FileEntryDesc, \%MayBeMissing, \%MayBeEmpty, \%MapLine);

# read the Firefox override locale files:
# these same files must be included in the override manifest created by build.pl
if (%OVERRIDES) {
  foreach my $override (sort keys %OVERRIDES) {
    &readLocaleOverrideFile($LOCALE, $LOCALE_FF, $override, $OVERRIDES{$override}, \%CodeFileEntryValues);
  }
}

# correlate UI descriptions to MAP entries
&correlateUItoMAP(\%UIDescValue, \%FileEntryDesc, \%MayBeMissing, \%MayBeEmpty, \%CodeFileEntryValues, \%MatchedDescriptions);

# write code files
for my $fe2 (sort keys %CodeFileEntryValues) {

  $fe2 =~ /^(.+?)\:(.+)\s*$/;
  my $f = "$LOCALECODE/$1";
  my $e = $2;
  my $v = $CodeFileEntryValues{$fe2};
  if ($IGNORE_SHORTCUT_KEYS && $fe2 =~ /$SHORTCUT/) {$FilteredShortcuts = 1; $v = "";}

  my $dir = $f;
  $dir =~ s/\/[^\/]+$//;
  if (!-e $dir) {make_path($dir);}
      
  if ($f ne $openfile) {
    if ($openfile) {close(OUTF);}
    if (!open(OUTF, ">>:encoding(UTF-8)", $f)) {&Log("ERROR: Could not open code file \"$f\"\n"); die;}
  }
  $openfile = $f;

  if ($f =~ /\.properties$/i) {print OUTF $e."=".$v."\n";}
  elsif ($f =~ /\.dtd$/i) {print OUTF "<!ENTITY ".$e." \"".$v."\">\n";}
  else {&Log("ERROR FileEntry=\"".$fe2."\": Unknown file type \"".$f."\"\n");}
  
}
close(OUTF);
if ($FilteredShortcuts) {&Log("WARNING: All access and command keys have been filtered out (Ignore_shortCut_keys=true).\n");}

# copy locale-files to new locale
my $localeFiles = "$LOCALEDIR/locale-files";
if (-e $localeFiles || -d $localeFiles) {
  &Log("INFO: Copying locale-files of \"$LOCALE\", $localeFiles\n");
  &copy_dir("$localeFiles", "$LOCALECODE/xulsword", "", "\.svn");
}
