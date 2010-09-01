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
&updateConfInfo("swordmk-mods");
&updateConfInfo("sword-mods");

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

sub updateConfInfo($) {
  my $dir = shift;
  opendir(CONF, "$MKS/moduleDev/$dir/mods.d");
  @confs = readdir(CONF);
  close(CONF);
  foreach $conf (@confs) {
    open(TMP, ">$MKS/moduleDev/$dir/tmp.conf");
    open(INC, "<$MKS/moduleDev/$dir/mods.d/$conf");
    $hasXSMversion = "false";
    $hasMinProgversionForXSM = "false";
    my $versification = "";
    my $mpvfxsm = $MinProgversionForXSM;
    my $xsmv = $XSMversion;
    while(<INC>) {
      if ($_ =~ /^\s*Versification\s*=\s*(.*)\s*$/) {$versification = $1;}
      if ($versification ne "" && $versification ne "EASTERN") {$mpvfxsm = "2.13"; $xsmv = "2.10";}
      if ($_ =~ s/^\s*(xulswordVersion\s*=\s*).*$/$1$xsmv/) {$hasXSMversion = "true";}
      if ($_ =~ s/^\s*(minMKVersion\s*=\s*).*$/$1$mpvfxsm/) {$hasMinProgversionForXSM = "true"};
      print TMP $_;
    }
    close(INC);
    if ($hasXSMversion eq "false") {print TMP "\nxulswordVersion=$xsmv\n";}
    if ($hasMinProgversionForXSM eq "false") {print TMP "minMKVersion=$mpvfxsm\n";}
    close(TMP);
    unlink(INC);
    rename("$MKS/moduleDev/$dir/tmp.conf", "$MKS/moduleDev/$dir/mods.d/$conf");
  }
}

sub processModuleGroup($@) {
  my $path = shift;
  my $listptr = shift;
  
  # Copy modules to installer location, handle indexes properly
  foreach $mod (@{$listptr}) {
    my $modlc = lc($mod);
    my $dir = "";
    if (-e "$MKS\\moduleDev\\swordmk-mods\\mods.d\\$modlc.conf") {$dir = "swordmk-mods";}
    elsif (-e "$MKS\\moduleDev\\sword-mods\\mods.d\\$modlc.conf") {$dir = "sword-mods";}
    else {&logit("Could not locate module $mod for copying."); next;}
    
    $log = "$MKS\\moduleDev\\$dir\\Out_EncryptTexts.txt";
    chdir("$MKS\\moduleDev\\$dir"); # so that mkfastmod will work!
  
    if ($IncludeIndexes eq "true") {
      print "Creating search index in $path for $mod...\n";
      &logit("Creating search index in $path for $mod...\n");
      if (-e "$MKS\\moduleDev\\$dir\\modules\\$path\\$modlc\\lucene") {`rmdir /Q /S \"$MKS\\moduleDev\\$dir\\modules\\$path\\$modlc\\lucene\"`;}
      $mykey="";
      open(INF, "<$MKS\\moduleDev\\$dir\\keys.txt") || die "Could not open $MKS\\moduleDev\\$dir\\keys.txt\n";
      while(<INF>) {if ($_ =~ /^(.*):$mod$/) {$mykey = $1;}}
      close(INF);
      if ($mykey ne "") {&setCipher("$MKS\\moduleDev\\$dir\\mods.d\\$modlc.conf", $mykey, $dir);}
      `\"$MK\\Cpp\\swordMK\\utilities\\bin\\mkfastmod.exe\" $mod >> \"$log\"`;
      if ($mykey ne "") {&setCipher("$MKS\\moduleDev\\$dir\\mods.d\\$modlc.conf", "", $dir);}
    }
    `copy \"$MKS\\moduleDev\\$dir\\mods.d\\$modlc.conf\" \"$ResDir\\mods.d\"`;
    `xcopy \"$MKS\\moduleDev\\$dir\\modules\\$path\\$modlc\" \"$ResDir\\modules\\$path\\$modlc\" /S /Y /I`;

    if ($IncludeIndexes ne "true" && -e "$MK\\xulrunner\\modules\\$path\\$modlc\\lucene") {`rmdir /S /Q \"$ResDir\\modules\\$path\\$modlc\\lucene\"`;}
  }
  
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

sub setCipher($$$) {
  my $c = shift;
  my $k = shift;
  my $d = shift;
  open(TMP, ">$MKS\\moduleDev\\$d\\tmp.xml") || die "Could not open $MKS\\moduleDev\\$d\\tmp.xml\n";
  open(CONF, "<$c") || die "Could not open $c\n";
  $haskey = "false";
  while(<CONF>) {
    if ($_ =~ s/^\s*CipherKey\s*=.*$/CipherKey=$k/) {$haskey = "true";}
    print TMP $_;
  }
  if ($haskey eq "false") {print TMP "CipherKey=$k\n";}
  close(CONF);
  close(TMP);
  unlink($c);
  rename ("$MKS\\moduleDev\\$d\\tmp.xml", $c);
}

sub logit($) {
  my $l = shift;
  open(LOGF, ">>$log") || die "Could not open log file $log\n";
  print LOGF $l;
  close(LOGF);
}