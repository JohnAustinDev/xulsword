#!/usr/bin/perl
#usage UpdateModulesLocales.pl MK MKS MKO ResDir AllLocales IncludeLocales IncludeIndexes XSMversion MinProgversionForXSM includeBibles includeCommentaries includeGenBooks includeDevotionals includeLexDict

$MK = shift;
$MKS = shift;
$MKO = shift;

$ResDir = shift;
$AllLocales = shift;
$IncludeLocales = shift;
$IncludeIndexes = shift;
$XSMversion = shift;
$MinProgversionForXSM = shift;
$IncludeBibles = shift;
$IncludeCommentaries = shift;
$IncludeGenBooks = shift;
$IncludeDevotionals = shift;
$IncludeLexDict = shift;

$AllLocales =~ s/(^\s*|\"|\s*$)//g;
$IncludeLocales =~ s/(^\s*|\"|\s*$)//g;
$IncludeBibles =~ s/(^\s*|\"|\s*$)//g;
$IncludeCommentaries =~ s/(^\s*|\"|\s*$)//g;
$IncludeGenBooks =~ s/(^\s*|\"|\s*$)//g;
$IncludeDevotionals =~ s/(^\s*|\"|\s*$)//g;
$IncludeLexDict =~ s/(^\s*|\"|\s*$)//g;

@allLocales = split(/\s*,\s*/, $AllLocales);
@includeLocales = split(/\s*,\s*/, $IncludeLocales);
@includeBibles = split(/\s*,\s*/, $IncludeBibles);
@includeCommentaries = split(/\s*,\s*/, $IncludeCommentaries);
@includeGenBooks = split(/\s*,\s*/, $IncludeGenBooks);
@includeDevotionals = split(/\s*,\s*/, $IncludeDevotionals);
@includeLexDict = split(/\s*,\s*/, $IncludeLexDict);

require "$MK/build/script/shared.pl";

# remove all but included locales
$hasEN = "false";
opendir(CHROME, "$MK/xulrunner/chrome");
@chromelist = readdir(CHROME);
close(CHROME);
  
foreach $entry (@chromelist) {
  if ($entry !~ /^(\w\w(-\w*)?)\.(locale\.manifest|jar|txt)$/) {next;}
  $locale = $1;
  if ($locale eq "en-US") {$hasEN = "true"; next;}
  $bk = "false";
  foreach $l (@includeLocales) {if ($locale eq $l) {$bk = "true"; last;}}
  if ($bk eq "true") {next;}
  if (-e "$MK\\xulrunner\\chrome\\$locale.jar") {`del /Q \"$MK\\xulrunner\\chrome\\$locale.*\"`;}
}
if ($hasEN eq "false") {`ren \"$MK\\xulrunner\\chrome\\en-US.locale.manifest\" \"en-US.nomenu.manifest\"`;}

# Delete existing modules from xulrunner dir
if (-e "$ResDir\\mods.d")            {`rmdir /S /Q \"$ResDir\\mods.d\"`;}
if (-e "$ResDir\\modules\\comments") {`rmdir /S /Q \"$ResDir\\modules\\comments\"`;}
if (-e "$ResDir\\modules\\genbook")  {`rmdir /S /Q \"$ResDir\\modules\\genbook\"`;}
if (-e "$ResDir\\modules\\lexdict")  {`rmdir /S /Q \"$ResDir\\modules\\lexdict\"`;}
if (-e "$ResDir\\modules\\texts")    {`rmdir /S /Q \"$ResDir\\modules\\texts\"`;}
`mkdir \"$ResDir\\mods.d\"`;
`mkdir \"$ResDir\\modules\\comments\\zcom\"`;
`mkdir \"$ResDir\\modules\\genbook\\rawgenbook\"`;
`mkdir \"$ResDir\\modules\\lexdict\\rawld\"`;
`mkdir \"$ResDir\\modules\\lexdict\\rawld\\devotionals\"`;
`mkdir \"$ResDir\\modules\\texts\\ztext\"`;

# Add or change version info for included modules
&updateConfInfo("swordmk-mods", $MinProgversionForXSM, $XSMversion);
&updateConfInfo("sword-mods", $MinProgversionForXSM, $XSMversion);

if (-e "$MKS/installer/autogen/uninstall.iss") {unlink("$MKS/installer/autogen/uninstall.iss");}
if (@includeBibles) {processModuleGroup("texts\\ztext", \@includeBibles);}
if (@includeCommentaries) {processModuleGroup("comments\\zcom", \@includeCommentaries);}
if (@includeGenBooks) {processModuleGroup("genbook\\rawgenbook", \@includeGenBooks);}
if (@includeDevotionals) {processModuleGroup("lexdict\\rawld\\devotionals", \@includeDevotionals);}
if (@includeLexDict) {processModuleGroup("lexdict\\rawld", \@includeLexDict);}
if (-e "$MKS/installer") {
  if (!(-e "$MKS/installer/autogen")) {mkdir("$MKS/installer/autogen");}
  if (!(-e "$MKS/installer/autogen/uninstall.iss")) {
    open(INF, ">$MKS/installer/autogen/uninstall.iss");
    print INF "{no modules installed}\n";
    close(INF);
  }
}

sub processModuleGroup($@) {
  my $path = shift;
  my $listptr = shift;
  
  copyModulesTo($path, \@{$listptr}, $IncludeIndexes, $ResDir);
  
  if (-e "$MKS/installer") {
    if (!(-e "$MKS/installer/autogen")) {mkdir("$MKS/installer/autogen");}
    # Hack uninstaller file
    if (!(-e "$MKS/installer/autogen/uninstall.iss")) {
      open(OUTF, ">$MKS/installer/autogen/uninstall.iss") || die "Could not open autogen/uninstall.iss";
      print OUTF "if ResultCode = 0 then\n";
      print OUTF "begin\n";
      print OUTF "  CreateDir(ExpandConstant('{userappdata}\\{#MyPublisher}'));\n";
      print OUTF "  CreateDir(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}'));\n";
      print OUTF "  CreateDir(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles'));\n";
      print OUTF "  CreateDir(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources'));\n";
      print OUTF "  SaveStringToFile(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\newInstalls.txt'), 'NewLocales;NewModules', False);\n";
      print OUTF "end;\n";
      close(OUTF);
    }

    # Create new code
    $modlist="";
    $code="";
    foreach $mod (@{$listptr}) {
      $modlc = lc($mod);
      $code = $code."  DelTree(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\modules\\".$path."\\".$modlc."'), True, True, True);\n";
      $code = $code."  DeleteFile(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\mods.d\\".$modlc.".conf'));\n";
      $modlist = $modlist.";".$mod;
    }

    # Insert new code
    $new = "";
    open(INF, "<$MKS/installer/autogen/uninstall.iss") || die "Could not open autogen/uninstall.iss";
    while (<INF>) {
      if ($_ =~ /^(\s*SaveStringToFile.*?')([^']+)(', False\);$)/) { #'{
        $st = $1;
        $man = $2;
        $en = $3;
        $newlocales = join(";", @includeLocales);
        $man =~ s/(NewLocales.*)(;NewModules)/NewLocales;$newlocales$2/;
        $man = $man.$modlist;
        $_ = $st.$man.$en."\n".$code;
      }
      $new = $new.$_;
    }
    close(INF);
    open(OUTF, ">$MKS/installer/autogen/uninstall.iss") || die "Could not open autogen/uninstall.iss";
    print OUTF $new;
    close(OUTF);
  }
}
