#!/usr/bin/perl

# Portable version differences: Append "P" to BuildID. Different executable.

#usage build.pl [build_settings.txt]

use File::Spec;
$TRUNK = File::Spec->rel2abs( __FILE__ );
$TRUNK =~ s/[\\\/]build[\\\/][^\\\/]+$//;
require "$TRUNK/build/script/common.pl";

&Log("----> Reading control file.\n");
$SETTING = shift;
if (!$SETTING) {$SETTING = "build_settings.txt";}
if (!-e $SETTING) {&Log("Build control file \"$SETTING\" not found.\n"); exit;}
open(SETF, "<:encoding(UTF-8)", $SETTING) || die;
$line = 0;
while(<SETF>) {
  $line++;
  if ($_ =~ /^\s*$/) {next;}
  elsif ($_ =~ /^#/) {next;}
  elsif ($_ =~ /^Set\s+(\S+)\s*=\s*(.*?)\s*$/i) {
    my $var=$1; my $val=$2;
    if ($var =~ /^(.*?\.js\)\:/) {$Prefs{$var} = $val;}
    else {$$1 = $2;}
  }
  else {&Log("ERROR: unhandled control file line $line: \"$_\"\n");}
}
close(SETF);
$Xsprocess = $Executable;
$Xsprocess =~ s/\.exe$/-srv.exe/i;
@ModRepos = ($ModuleRepository1, $ModuleRepository2);

&Log("----> Checking file paths.\n");
if ($OutputDirectory =~ /^\./) {
  $OutputDirectory = File::Spec->rel2abs($OutputDirectory);
}
if ($ModuleRepository =~ /^\./) {
  $ModuleRepository = File::Spec->rel2abs($ModuleRepository);
}
if (!-e $OutputDirectory) {
  print "Create output directory \"$OutputDirectory\"?: [y/n]\n";
  my $ans = <>;
  if ($ans !~ /^y$/i) {exit;}
  make_path($OutputDirectory);
}
if (!-e $ModuleRepository) {
  &Log("WARNING: module repository does not exist: \"$ModuleRepository\"\n");
}

&Log("----> Deleting \"$TRUNK/$Name\"\n");
if (-e "$TRUNK/$Name") {remove_tree("$TRUNK/$Name");}
mkdir("$TRUNK/$Name");
$DEVELOPMENT="$TRUNK/$Name/development";
$INSTALLER="$TRUNK/$Name/installer";
$FFEXTENSION="$TRUNK/$Name/extension";
$PORTABLE="$TRUNK/$Name/portable";
if ("$^O" =~ /MSWin32/i) {$Appdata = `Set APPDATA`; $Appdata =~ s/APPDATA=(.*?)\s*$/$1/i;}
else {&Log("ERROR: need to assign Linux application directory\n");}

&writeCompileDeps();

if ($MakeDevelopment =~ /true/i) {
  &Log("----> BUILDING DEVELOPMENT ENVIRONMENT\n");
  make_path($DEVELOPMENT);
  &compileLibSword();
  &writeAllPreferences($DEVELOPMENT);
  my @manifest;
  &copyExtensionFiles($DEVELOPMENT, @manifest, 1);
  &writeApplicationINI($DEVELOPMENT);
  &includeModules($IncludeModules, \@ModRepos, "$Appdata/$Vendor/$Name/Profiles/resources", $IncludeSearchIndexes);
  &writeManifest(\@manifest, $DEVELOPMENT);
}
if ($MakeFFextension =~ /true/i) {
  &Log("----> BUILDING FIREFOX EXTENSION\n");
  make_path($FFEXTENSION);
  &compileLibSword($FFEXTENSION);
  &writeAllPreferences($FFEXTENSION);
  my @manifest;
  &copyExtensionFiles($FFEXTENSION, @manifest);
  &writeFFInstallFiles();
  &writeManifest(\@manifest, $FFEXTENSION);
}
if ($MakePortable =~ /true/i) {
  &Log("----> BUILDING PORTABLE VERSION\n");
  make_path("$PORTABLE/$Name");
  make_path("$PORTABLE/resources");
  make_path("$PORTABLE/profile");
  &compileLibSword("$PORTABLE/$Name");
  &writeAllPreferences("$PORTABLE/$Name");
  my @manifest;
  &copyExtensionFiles("$PORTABLE/$Name", @manifest);
  &writeApplicationINI("$PORTABLE/$Name", 1);
  &compileStartup($PORTABLE);
  &includeModules($IncludeModules, \@ModRepos, "$PORTABLE/resoures", $IncludeSearchIndexes);
  &writeManifest(\@manifest, "$PORTABLE/$Name");
  open(NIN, ">:encoding(UTF-8)", "$PORTABLE/resources/newInstalls.txt") || die;
  print NIN "NewLocales;en-US\n"; # this opens language menu on first run
  close(NIN);
}
if ($MakeSetup =~ /true/i) {
  if ($Target eq "Windows") {
    if (-e "$XulswordExtras/installer") {
      &Log("----> BUILDING SETUP INSTALLER\n");
      make_path($INSTALLER);
      &compileLibSword($INSTALLER);
      &writeAllPreferences($INSTALLER);
      my @manifest;
      &copyExtensionFiles($INSTALLER, @manifest);
      &writeApplicationINI($INSTALLER);
      &compileStartup($INSTALLER);
      if (-e "$Appdata/$Vendor/$Name/Profiles/resources/mods.d") {
        &Log("----> Deleting \"$Appdata/$Vendor/$Name/Profiles/resources/mods.d\"\n");
      }
      if (-e "$Appdata/$Vendor/$Name/Profiles/resources/modules") {
        &Log("----> Deleting \"$Appdata/$Vendor/$Name/Profiles/resources/modules\"\n");
      }
      &includeModules($IncludeModules, \@ModRepos, "$Appdata/$Vendor/$Name/Profiles/resources", $IncludeSearchIndexes);
      &writeManifest(\@manifest, $INSTALLER);
      if (!-e "$XulswordExtras/installer/autogen") {mkdir "$XulswordExtras/installer/autogen";}
      &writeInstallerAppInfo("$XulswordExtras/installer/autogen/appinfo.iss");
      &writeInstallerLocaleinfo($IncludeLocales, "$XulswordExtras/installer/autogen/localeinfo.iss")
      &writeInstallerModuleUninstall($IncludeModules, $IncludeLocales, "$XulswordExtras/installer/autogen/uninstall.iss", "$Appdata/$Vendor/$Name/Profiles/resources");
    }
    else {&Log("ERROR: the Inno Setup 5 installer script is missing.\n");}
  }
  else {&Log("ERROR: the installer has not yet been implemented for your platform.\n");}
}
&createLocaleExtensions(split(/\s*,\s*/, $IncludeLocales));
if ("$^O" =~ /MSWin32/i && $Target eq "Windows") {&writeWindowsRegistryScript();}
  
################################################################################
################################################################################
sub writeCompileDeps() {
  &Log("----> Writing application info for C++ compiler.\n");
  if (!-e "$TRUNK/Cpp/Release") {mkdir "$TRUNK/Cpp/Release";}
  open(INFO, ">:encoding(UTF-8)", "$TRUNK/Cpp/Release/appInfo.h") || die;
  print INFO "#define PATH_TO_PROGRAM L\"%s\\\\$Executable\"\n";
  print INFO "#define PORTABLE_DIR L\".\\\\$Name\"\n";
  print INFO "#define KEYADDRESS L\"Software\\\\$Vendor\\\\$Name\"\n";
  print INFO "#define PROC_NAME L\"$Xsprocess\"\n";
  close(INFO);

  &Log("----> Writing path info for C++ compiler.\n");
  if ("$^O" =~ /MSWin32/i && $Target eq "Windows") {
    open(INFO, ">:encoding(UTF-8)", "$TRUNK/Cpp/Versions.bat") || die;
    print INFO "Set clucene=$CluceneSource\n";
    print INFO "Set sword=$SwordSource\n";
    print INFO "Set microsoftsdk=$MicrosoftSDK\n";
    close(INFO);
  }
  else {&Log("ERROR: you need to pass path information to the compile script of your platform.\n");}
}

sub compileLibSword($) {
  my $do = shift;

  &Log("----> Compiling libsword binary.\n");
  if (!$CompiledAlready) {
    if ("$^O" =~ /MSWin32/i && $Target eq "Windows") {
      if (!-e "$TRUNK/Cpp/cluceneMK/lib/Release/libclucene.lib") {
        chdir("$TRUNK/Cpp/cluceneMK/lib");
        `Compile.bat`;
      }
      if (!-e "$TRUNK/Cpp/swordMK/lib/Release/libsword.lib") {
        chdir("$TRUNK/Cpp/swordMK/lib");
        `Compile.bat`;
      }
      chdir("$TRUNK/Cpp");
      if ($UseSecurityModule =~ /true/i) {
        `Compile.bat`;
      }
      else {
        `Compile.bat NOSECURITY`;
      }
      if (!-e "$TRUNK/Cpp/Release/xulsword.dll") {&Log("ERROR: libsword did not compile.\n");}
      elsif ($do) {
        copy("$TRUNK/Cpp/Release/xulsword.dll", $do);
        $CompiledAlready = 1;
      }
      chdir("$TRUNK/build");
    }
    else {&Log("ERROR: Please make and call a compile script for your platform.\n");}
  }
}

sub writeAllPreferences($) {
  my $do = shift;
  &Log("----> Writing preferences.\n");
  &writePrefs("$do/defaults/pref/prefs.js", \%Prefs);
  &writePrefs("$do/defaults/pref/language.js", \%Prefs);
  &writePrefs("$do/defaults/pref/buildprefs.js", \%Prefs);

  if ($MakeDevelopment =~ /true/i) {
    &writePrefs("$do/defaults/pref/debug.js", \%Prefs);
  }
}

sub copyExtensionFiles($\@$) {
  my $do = shift;
  my $manifestP = shift;
  my $makeDevelopment = shift;

  &Log("----> Copying Firefox extension files.\n");
  &copy_dir("$TRUNK/xul/xulrunnerDevAndProd/xulrunner", $do, "\\.svn", "\\.svn");

  &Log("----> Compiling manifest file.\n");
  if ($makeDevelopment) {
    push(@{$manifestP}, "content xulsword file:../../xul/xulsword/");
    push(@{$manifestP}, "locale xulsword en-US file:../../xul/en-US.xs/en-US-xulsword/xulsword/");
    push(@{$manifestP}, "skin xulsword skin file:../../xul/skin/");
  }
  else {
    push(@{$manifestP}, "content xulsword jar:chrome/xulsword.jar!/");
    push(@{$manifestP}, "locale xulsword en-US jar:chrome/en-US.xs.jar!/xulsword/");
    push(@{$manifestP}, "skin xulsword skin jar:chrome/skin.jar!/");

    &Log("----> Creating JAR files.\n");
    &makeJAR("$do/chrome/xulsword.jar", "$TRUNK/xul/xulsword");
    &makeJAR("$do/chrome/en-US.xs.jar", "$TRUNK/xul/en-US.xs/en-US-xulsword");
    &makeJAR("$do/chrome/skin.jar", "$TRUNK/xul/skin");
  }
  push (@{$manifestP}, "override chrome://global/content/printPageSetup.xul chrome://xulsword/content/xulrunner/global/printPageSetup.xul");
  push (@{$manifestP}, "override chrome://global/content/printPreviewBindings.xml chrome://xulsword/content/xulrunner/global/printPreviewBindings.xml");
  push (@{$manifestP}, "override chrome://global/content/printPreviewProgress.xul chrome://xulsword/content/xulrunner/global/printPreviewProgress.xul");
  push (@{$manifestP}, "override chrome://global/content/printProgress.xul chrome://xulsword/content/xulrunner/global/printProgress.xul");
  push (@{$manifestP}, "override chrome://global/content/bindings/tree.xml chrome://xulsword/content/xulrunner/global/bindings/tree.xml");
  push (@{$manifestP}, "override chrome://mozapps/content/handling/dialog.xul chrome://xulsword/content/xulrunner/mozapps/handling/dialog.xul");
}

sub writeApplicationINI($$) {
  my $do = shift;
  my $isPortable = shift;

  &Log("----> Writing application.ini.\n");
  @d = localtime(time);
  $BuildID = sprintf("%02d%02d%02d", ($d[5]%100), ($d[4]+1), $d[3]);
  if ($isPortable) {$BuildID .= "P";}
  open(INI, ">:encoding(UTF-8)", "$do/application.ini") || die;
  print INI "[App]\n";
  print INI "Vendor=$Vendor\n";
  print INI "Name=$Name\n";
  print INI "Version=$Version\n";
  print INI "BuildID=$BuildID\n\n";
  print INI "[Gecko]\n";
  print INI "MinVersion=$GeckoMinVersion\n";
  print INI "MaxVersion=$GeckoMaxVersion\n";
  close(INI);
}

sub &includeModules($\@$$) {
  my @modules = split(/\s*,\s*/, shift);
  my $repsP = shift;
  my $do = shift;
  my $includeIndexes = shift;

  my $path;
  foreach my $mod (@modules) {
    foreach my $di (@{$repsP}) {
      $path = "$di/mods.d/".lc($mod).".conf";
      if (-e $path) {last;}
    }
    if (!-e $path) {&Log("ERROR: could not locate conf for module $mod\n"); next;}
    if (!$Conf{$mod}{"DataPath"}) {&getInfoFromConf($path);}
    if (!$Conf{$mod}{"DataPath"}) {&Log("ERROR: could not read conf file $path\n"); next;}
    my $mpath = $path;
    $mpath =~ s/mods\.d\/[^\/]$//;
    $mpath .= $Conf{$mod}{"DataPath"};
    if (!-e $mpath) {&Log("ERROR: module $mod files not found in $mpath.\n"); next;}
    if ($includeIndexes && !-e "$mpath/lucene") {&Log("ERROR: search index requested but is not available.\n");}
    my $dfilter = ($includeIndexes ? "":"lucene");
    my $confd = "$do/mods.d/".lc($mod).".conf";
    my $modfd = "$do/".$Conf{$mod}{"DataPath"};
    if (-e $confd) {unlink($confd);}
    if ($modfd =~ /modules/ && -e $modfd) {remove_tree($modfd);}
    copy_dir($mpath, $modfd, "", $dfilter);
    copy($path, $confd);
  }
}

sub writeManifest(\@$) {
  my $maP = shift;
  my $od = shift;
  
  open(MAN, ">:encoding(UTF-8)", "$od/chrome.manifest") || die "Could not open chrome manifest \"$od/chrome.manifest\"\n";
  foreach $e (@{$maP}) {print MAN "$e\n";}
  close(MAN);
}


sub compileStartup($) {
  my $do = shift;

  my $rd;
  if ($do eq $PORTABLE)  {$rd = "runPortable";}
  if ($do eq $INSTALLER) {$rd = "runMK";}
  else {&Log("ERROR: no startup stub for \"$do\"\n"); return;}

  &Log("----> Compiling startup stub.\n");
  chdir("$TRUNK/Cpp/$rd");
  remove_tree("$TRUNK/Cpp/$rd/Release");
  `Compile.bat`;
  copy("$TRUNK/Cpp/$rd/Release/$rd.exe", "$do/$Executable");
  move("$do/xulrunner.exe", "$do/$Xsprocess");
}

sub writeInstallerAppInfo($) {
  my $of = shift;
  &Log("----> Writing installer script.\n");
  open (ISS, ">:encoding(UTF-8)", $of) || die;
  print ISS "#define MyAppName \"$Name\"\n";
  print ISS "#define MyAppExeName \"$Executable\"\n";
  print ISS "#define MyPublisher \"$Vendor\"\n";
  print ISS "#define MyDecimalVersion \"$Version\"\n";
  print ISS "#define MyVersion \"$Version\"\n";
  print ISS "#define securitymod \"$UseSecurityModule\"\n";
  print ISS "#define HebrewFont \"$IncludeHebrewFont\"\n";
  print ISS "#define MK \"$TRUNK\"\n";
  print ISS "#define MKS \"$XulswordExtras\"\n";
  print ISS "#define MKO \"$OutputDirectory\"\n";
  print ISS "#define APPDATA \"$Appdata\"\n";
  close(ISS);
}

sub writeInstallerLocaleinfo($$) {
  my @locales = split(/\s*,\s*/, shift);
  my $of = shift;

  open(OUTF, ">:encoding(UTF-8)", $of) || die;
  
  # this script use to write =false for all possible locales (needed??)
  foreach my $locale (@locales) {
    my $pl = $locale; $pl =~ s/-//g; # iss defines can't use "-"
    print OUTF "#define $pl \"true\"\n";
  }
  close(OUTF);
}

sub writeInstallerModuleUninstall($$$$) {
  my @modules = split(/\s*,\s*/, shift);
  my @locales = split(/\s*,\s*/, shift);
  my $of = shift;
  my $md = shift;
  
  my $newInstalls = "NewLocales;" # don't list any locales- language menu should not open after setup install
  $newInstalls .= "NewModules";
  if ($modules) {$newInstalls .= ";".join(";", @modules);}

  open(OUTF, ">:encopding(UTF-8)", $of) || die;
  print OUTF "SaveStringToFile(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\newInstalls.txt'), '$newInstalls', False);\n";
  foreach my $mod (@modules) {
    &getInfoFromConf("$md/mods.d/".lc($mod).".conf");
    print OUTF "DelTree(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\".$Conf{$mod}{"DataPath"}."'), True, True, True);\n";
    print OUTF "DeleteFile(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\mods.d\\".lc($mod).".conf'));\n";
  }
  close(OUTF);
}

sub writeWindowsRegistryScript() {
  &Log("----> Writing Windows registry script.\n");
  if (!-e "$TRUNK/build/autogen") {mkdir "$TRUNK/build/autogen";}
  open (REG, ">:encoding(UTF-8)", "$TRUNK/build/autogen/setRegistry.reg") || die;
  my $id = "$OutputDirectory/toCDROM/Install/setup"; $id =~ s/[\\\/]/\\\\/g;
  my $rd = "$TRUNK/xulrunner"; $rd =~ s/[\\\/]/\\\\/g;
  my $ad = "$OutputDirectory/audio"; $ad =~ s/[\\\/]/\\\\/g;
  print REG "Windows Registry Editor Version 5.00\n";
  print REG "[HKEY_LOCAL_MACHINE\\SOFTWARE\\$Vendor\\$Name]\n";
  print REG "\"InstallDrive\"=\"$id\"\n";
  print REG "\"RunDir\"=\"$rd\"\n";
  print REG "\"AudioDir\"=\"$ad\"\n";
  print REG "\"Version\"=\"$Version\"\n";
}

sub createLocaleExtensions(\@) {
  my @LocalesP = shift;
  
  &Log("----> Creating Locale extensions.\n");
  foreach my $loc (@{$LocalesP}) {
    if ($loc eq "en-US") {next;}
    &createLocaleExtension($loc, "$FFEXTENSION");
    copy("$XulswordExtras/localeDev/$loc/$loc.rdf", "$FFEXTENSION/defaults");
  }
}

