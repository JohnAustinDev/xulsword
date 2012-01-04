#!/usr/bin/perl
#usage UpdateJars.pl MK MKS MKO isProduction UIversion MinProgversionForUI IncludeLocales AllLocales
use File::Copy;
use File::Compare;
    
$MK = shift;
$MKS = shift;
$MKO = shift;

$isProduction = shift;
$UIversion = shift;
$MinProgversionForUI = shift;
$IncludeLocales = shift;
$AllLocales = shift;

$IncludeLocales =~ s/(^\s*|\"|\s*$)//g;
$AllLocales =~ s/(^\s*|\"|\s*$)//g;

@includeLocales = split(/\s*,\s*/, $IncludeLocales);
@allLocales = split(/\s*,\s*/, $AllLocales);

# Create new skin and content jar files
unlink("$MK/xulrunner/chrome/xulsword.jar");
unlink("$MK/xulrunner/chrome/skin.jar");
`7za a -tzip \"$MK\\xulrunner\\chrome\\xulsword.jar\" -r \"$MK\\xul\\xulsword\\*\" -x!.svn`;
`7za a -tzip \"$MK\\xulrunner\\chrome\\skin.jar\" -r \"$MK\\xul\\skin\\*\" -x!.svn`;

# Create new locale jar files and locale manifest files
# en-US is always updated and always exists in the xulrunner directory
unlink ("$MK/xulrunner/chrome/en-US.xs.jar");
`7za a -tzip \"$MK\\xulrunner\\chrome\\en-US.xs.jar\" \"$MK\\xul\\en-US.xs\\en-US-xulsword\\*\" -x!.svn`;
`7za a -tzip \"$MK\\xulrunner\\chrome\\en-US.jar\" -r \"$MK\\xul\\en-US\\*\" -x!.svn`;
`copy /Y \"$MK\\xul\\en-US.xs\\en-US.rdf\" \"$MK\\xulrunner\\defaults\\"`;

# Now handle all locales other than en-US
if (-e "$MKS/localeDev/locales") {`rmdir /S /Q \"$MKS\\localeDev\\locales\"`;}
mkdir("$MKS/localeDev/locales");

foreach $locale (@allLocales) {
  # write all manifest files for locales 
  # the en-US manifest has already been copied from the xulrunnerProduction or xulrunnerDevelopment directory
  if ($locale eq "en-US") {next;}
  open("OUTF", ">$MKS/localeDev/locales/$locale.locale.manifest") || die "Could not open $locale.locale.manifest\n";
  $manpath = "jar:$locale.jar!";
  #if ($isProduction eq "true") {$manpath = "jar:$locale.jar!";} else {$manpath = "file:../../xul/$locale/xulsword";} # file: must be relative, but locale dir can now move... what else to do?
  print OUTF "locale xulsword $locale $manpath/xulsword/\n";
  print OUTF "locale global $locale jar:$locale.jar!/global/\n"; # must always use jar, because global is result of a merge
  print OUTF "locale mozapps $locale jar:$locale.jar!/mozapps/\n"; # must always use jar, because global is result of a merge
  if (-e "$MKS/localeDev/$locale/text-skin") {
    print OUTF "skin localeskin $locale $manpath/skin/\n";
  }
  print OUTF "# xulswordVersion=$UIversion\n";
  print OUTF "# minMKVersion=$MinProgversionForUI\n";
  close(OUTF);
  
  # create new jar files for each locale
  move("$MKS\\localeDev\\$locale\\code_log.txt", "$MKS\\localeDev\\$locale\\code_log-bak.txt");
  `$MK\\localeDev\\UI-code.pl "$MK" "$MKS" $locale`;
  if (compare("$MKS\\localeDev\\$locale\\code_log.txt", "$MKS\\localeDev\\$locale\\code_log-bak.txt") != 0) {
    print "WARNING: $locale LOG FILE HAS CHANGED. PLEASE CHECK IT!!\n";
  }
  unlink("$MKS\\localeDev\\$locale\\code_log-bak.txt");  
  $firefox = "";
  if (open(INF, "<$MKS\\localeDev\\$locale\\UI-$locale.txt")) {
    while (<INF>) {if ($_ =~ /Firefox_locale=([^,]+)/) {$firefox = $1; last;}}
    close(INF);
  }
  if ($firefox eq "") {print "ERROR! DEFAULTING TO en-US FOR LOCALE $locale!!\n"; $firefox = "en-US";}
  if ($firefox && !-e "$MKS\\localeDev\\Firefox3\\$firefox") {
    if ($firefox eq "en-US") {print "ERROR! DEFAULT FIREFOX LOCALE NOT FOUND \"$MKS\\localeDev\\Firefox3\\en-US\"\n";}
    else {print "ERROR! FIREFOX LOCALE NOT FOUND \"$MKS\\localeDev\\Firefox3\\$firefox\"\n";}
    $firefox = "en-US";
  }
  `7za a -tzip \"$MKS\\localeDev\\locales\\$locale.jar\" -r \"$MKS\\localeDev\\Firefox3\\$firefox\\locale\\$firefox\\global\" -x!.svn`;
  `7za a -tzip \"$MKS\\localeDev\\locales\\$locale.jar\" -r \"$MKS\\localeDev\\Firefox3\\$firefox\\locale\\$firefox\\mozapps\" -x!.svn`;
  `7za a -tzip \"$MKS\\localeDev\\locales\\$locale.jar\" -r \"$MKS\\localeDev\\$locale\\locale\\*\" -x!.svn`;
  if (-e "$MKS/localeDev/$locale/text-skin") {
    `7za a -tzip \"$MKS\\localeDev\\locales\\$locale.jar\" -r \"$MKS\\localeDev\\$locale\\text-skin\\*\" -x!.svn`;
  }
  
  # copy rdf file to destination
  `copy /Y \"$MKS\\localeDev\\$locale\\$locale.rdf\" \"$MK\\xulrunner\\defaults\\\"`;
  
  $hasLocale = "false";
  foreach $l (@includeLocales) {if ($l eq $locale) {$hasLocale = "true";}}
  if ($hasLocale eq "false") {next;}
  
  # if an included locale has its own skin write it into the skin.jar
  if ($skinDone eq "" && -e "$MKS/localeDev/$locale/locale-skin") {
    $skinDone = "true";
    `7za a -tzip \"$MK\\xulrunner\\chrome\\skin.jar\" -r \"$MKS\\localeDev\\$locale\\locale-skin\\*\" -x!.svn`;
  }
}

# Copy updated jar files and manifests to xulrunner dir, because all these must 
# be present during compile so that their CRCs can be calculated and remembered.
`copy /Y \"$MKS\\localeDev\\locales\\*.jar\" \"$MK\\xulrunner\\chrome\\\"`;
`copy /Y \"$MKS\\localeDev\\locales\\*.manifest\" \"$MK\\xulrunner\\chrome\\\"`;
