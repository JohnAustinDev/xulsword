#!/usr/bin/perl
#usage build.pl [build_settings.txt]

$Debug_debug_prefs = 0;  # 1 = add debug prefs to all builds (not just the development build)

use File::Spec;
$TRUNK = File::Spec->rel2abs( __FILE__ );
$TRUNK =~ s/[\\\/]build[\\\/][^\\\/]+$//;
$TRUNK =~ s/\\/\//g;
$LOGFILE = File::Spec->rel2abs( __FILE__ );
$LOGFILE .= "_log.txt";
if (-e $LOGFILE) {unlink($LOGFILE);}
require "$TRUNK/build/script/common.pl";

$SETTING = shift;
if (!$SETTING) {$SETTING = "build_settings.txt";}
if (!-e $SETTING) {&Log("Build control file \"$SETTING\" not found.\n"); exit;}
&Log("----> Reading control file: \"$SETTING\".\n");
open(SETF, "<:encoding(UTF-8)", $SETTING) || die;
$line = 0;
while(<SETF>) {
  $line++;
  if ($_ =~ /^\s*$/) {next;}
  elsif ($_ =~ /^(\:\:|rem|\#)/i) {next;}
  elsif ($_ =~ /^Set\s+(\S+)\s*=\s*(.*?)\s*$/i) {
    my $var=$1; my $val=$2;
    if ($var =~ /^\(.*?\.js\)\:/) {$Prefs{$var} = $val;}
    else {$$1 = $2;}
  }
  else {&Log("WARNING: unhandled control file line $line: \"$_\"\n");}
}
close(SETF);
$Xsprocess = $Executable;
$Xsprocess =~ s/\.exe$/-srv.exe/i;
@ModRepos = ($ModuleRepository1, $ModuleRepository2);

&Log("----> Getting file paths.\n");
if ($OutputDirectory =~ /^\./) {
  $OutputDirectory = File::Spec->rel2abs($OutputDirectory);
}
if (!-e $OutputDirectory) {make_path($OutputDirectory);}
if (!-e "$TRUNK/build-files/$Name") {make_path("$TRUNK/build-files/$Name");}
$DEVELOPMENT="$TRUNK/build-files/$Name/development";
$INSTALLER="$TRUNK/build-files/$Name/installer";
$FFEXTENSION="$TRUNK/build-files/$Name/extension";
$PORTABLE="$TRUNK/build-files/$Name/portable/$Name";
if ("$^O" =~ /MSWin32/i) {$Appdata = `Set APPDATA`; $Appdata =~ s/APPDATA=(.*?)\s*$/$1/i;}
else {&Log("ERROR: Please add assignment to application directory of your platform\n");}

&writeCompileDeps();

# DEVELOPMENT ENVIRONMENT
if ($MakeDevelopment =~ /true/i) {
  &Log("\n----> BUILDING DEVELOPMENT ENVIRONMENT\n");
  if (-e $DEVELOPMENT) {remove_tree($DEVELOPMENT);}
  make_path($DEVELOPMENT);
  &compileLibSword($DEVELOPMENT);
  my @manifest;
  &copyExtensionFiles($DEVELOPMENT, \@manifest, $IncludeLocales, 1);
  &copyXulRunnerFiles($DEVELOPMENT);
  $Prefs{"(prefs.js):toolkit.defaultChromeURI"} = "chrome://xulsword/content/splash.xul";
  &writePreferences($DEVELOPMENT, \%Prefs, 1);
  &writeApplicationINI($DEVELOPMENT);
  &includeModules($IncludeModules, \@ModRepos, "$Appdata/$Vendor/$Name/Profiles/resources", $IncludeSearchIndexes);
  &processLocales($IncludeLocales, \@manifest, $DEVELOPMENT);
  &writeManifest(\@manifest, $DEVELOPMENT);
  &writeRunScript($Name, $DEVELOPMENT, "dev");
}

# FIREFOX EXTENSION
if ($MakeFFextension =~ /true/i) {
  &Log("\n----> BUILDING FIREFOX EXTENSION\n");
  if (-e $FFEXTENSION) {remove_tree($FFEXTENSION);}
  make_path($FFEXTENSION);
  &compileLibSword($FFEXTENSION);
  my @manifest;
  push(@manifest, "overlay chrome://browser/content/browser.xul chrome://xulsword/content/extension-overlay.xul");
  &copyExtensionFiles($FFEXTENSION, \@manifest, $IncludeLocales, 0, 1);
  $Prefs{"(prefs.js):toolkit.defaultChromeURI"} = "";
  &writePreferences($FFEXTENSION, \%Prefs);
  &includeModules($IncludeModules, \@ModRepos, "$FFEXTENSION/resources", $IncludeSearchIndexes);
  &processLocales($IncludeLocales, \@manifest, $FFEXTENSION);
  &writeManifest(\@manifest, $FFEXTENSION);
  &packageFFExtension($FFEXTENSION, "$OutputDirectory/$Name-Extension-$Version");
}

# PORTABLE VERSION
if ($MakePortable =~ /true/i) {
  &Log("\n----> BUILDING PORTABLE VERSION\n");
  if (-e $PORTABLE) {remove_tree($PORTABLE);}
  make_path("$PORTABLE/$Name");
  make_path("$PORTABLE/resources");
  make_path("$PORTABLE/profile");
  &compileLibSword("$PORTABLE/$Name");
  my @manifest;
  &copyExtensionFiles("$PORTABLE/$Name", \@manifest, $IncludeLocales);
  &copyXulRunnerFiles("$PORTABLE/$Name");
  $Prefs{"(prefs.js):toolkit.defaultChromeURI"} = "chrome://xulsword/content/splash.xul";
  &writePreferences("$PORTABLE/$Name", \%Prefs);
  &writeApplicationINI("$PORTABLE/$Name", "P");
  &compileStartup($PORTABLE);
  &includeModules($IncludeModules, \@ModRepos, "$PORTABLE/resources", $IncludeSearchIndexes);
  &processLocales($IncludeLocales, \@manifest, "$PORTABLE/$Name");
  &writeManifest(\@manifest, "$PORTABLE/$Name");
  open(NIN, ">:encoding(UTF-8)", "$PORTABLE/resources/newInstalls.txt") || die;
  print NIN "NewLocales;en-US\n"; # this opens language menu on first run
  close(NIN);
  &packagePortable($PORTABLE, "$OutputDirectory/$Name-Portable-$Version");
  &writeRunScript($Name, $PORTABLE, "port");
}

# WINDOWS INSTALLER VERSION
if ($MakeSetup =~ /true/i) {
  &Log("\n----> BUILDING PROGRAM INSTALLER\n");
  if (-e $INSTALLER) {remove_tree($INSTALLER);}
  make_path($INSTALLER);
  &compileLibSword($INSTALLER);
  my @manifest;
  &copyExtensionFiles($INSTALLER, \@manifest, $IncludeLocales);
  &copyXulRunnerFiles($INSTALLER);
  $Prefs{"(prefs.js):toolkit.defaultChromeURI"} = "chrome://xulsword/content/splash.xul";
  &writePreferences($INSTALLER, \%Prefs);
  &writeApplicationINI($INSTALLER);
  &compileStartup($INSTALLER);
  if (-e "$Appdata/$Vendor/$Name/Profiles/resources/mods.d") {
    &Log("----> Deleting ...resources/mods.d\n");
    remove_tree("$Appdata/$Vendor/$Name/Profiles/resources/mods.d");
  }
  if (-e "$Appdata/$Vendor/$Name/Profiles/resources/modules") {
    &Log("----> Deleting ...resources/modules\n");
    remove_tree("$Appdata/$Vendor/$Name/Profiles/resources/modules");
  }
  &includeModules($IncludeModules, \@ModRepos, "$Appdata/$Vendor/$Name/Profiles/resources", $IncludeSearchIndexes);
  &processLocales($IncludeLocales, \@manifest, $INSTALLER);
  &writeManifest(\@manifest, $INSTALLER);
  &writeRunScript($Name, $PORTABLE, "install");

  if ("$^O" =~ /MSWin32/i) {
    if (!-e "$XulswordExtras/installer/autogen") {make_path("$XulswordExtras/installer/autogen");}
    &writeInstallerAppInfo("$XulswordExtras/installer/autogen/appinfo.iss");
    &writeInstallerLocaleinfo($IncludeLocales, "$XulswordExtras/installer/autogen/localeinfo.iss")
    &writeInstallerModuleUninstall($IncludeModules, $IncludeLocales, "$XulswordExtras/installer/autogen/uninstall.iss", "$Appdata/$Vendor/$Name/Profiles/resources");
    &packageWindowsSetup("$XulswordExtras/installer/scriptProduction.iss");
  }
  else {&Log("ERROR: Please add an installer creator script for your platform.\n");}
}

&Log("FINISHED BUILDING\n");
print "Press enter to close...\n";
$p = <>;

################################################################################
################################################################################

sub writeCompileDeps() {
  if ($UseSecurityModule =~ /true/i) {
    if (!-e $KeyGenPath) {
      &Log("ERROR: You cannot use the security module without supplying a key generator. (UseSecurityModule=true, KeyGenPath=???)\n");
      die;
    }
  }
  
  &Log("----> Writing application info for C++ compiler.\n");
  if (!-e "$TRUNK/Cpp/Release") {mkdir "$TRUNK/Cpp/Release";}
  open(INFO, ">:encoding(UTF-8)", "$TRUNK/Cpp/appInfo.h") || die;
  print INFO "#define PATH_TO_PROGRAM L\"%s\\\\$Executable\"\n";
  print INFO "#define PORTABLE_DIR L\".\\\\$Name\"\n";
  print INFO "#define KEYADDRESS L\"Software\\\\$Vendor\\\\$Name\"\n";
  print INFO "#define PROC_NAME L\"$Xsprocess\"\n";
  if ($UseSecurityModule =~ /true/i) {
     print INFO "#include \"$KeyGenPath\"\n";
  }
  close(INFO);

  if (!-e $SwordSource) {&Log("ERROR: No SWORD source code.\n"); die;}
  if (!-e $CluceneSource) {&Log("ERROR: No Clucene source code.\n"); die;}
  if (!-e $MicrosoftSDK) {&Log("ERROR: No Microsoft SDK.\n"); die;}
  
  &Log("----> Writing path info for C++ compiler.\n");
  if ("$^O" =~ /MSWin32/i) {
    open(INFO, ">:encoding(UTF-8)", "$TRUNK/Cpp/Versions.bat") || die;
    print INFO "Set clucene=$CluceneSource\n";
    print INFO "Set sword=$SwordSource\n";
    print INFO "Set microsoftsdk=$MicrosoftSDK\n";
    print INFO "Set Name=$Name\n";
    close(INFO);
  }
  else {&Log("ERROR: Please add code for your platform.\n");}
}

sub compileLibSword($) {
  my $do = shift;
  &Log("----> Compiling libsword binary.\n");
  if ("$^O" =~ /MSWin32/i) {
    if (!$CompiledAlready) {
      if (!-e "$TRUNK/Cpp/cluceneMK/lib/Release/libclucene.lib") {
        chdir("$TRUNK/Cpp/cluceneMK/lib");
        `call Compile.bat >> $LOGFILE`;
      }
      if (!-e "$TRUNK/Cpp/swordMK/lib/Release/libsword.lib") {
        chdir("$TRUNK/Cpp/swordMK/lib");
        `call Compile.bat >> $LOGFILE`;
      }
      chdir("$TRUNK/Cpp");
      if ($UseSecurityModule =~ /true/i) {
        `call Compile.bat >> $LOGFILE`;
      }
      else {
        `call Compile.bat NOSECURITY >> $LOGFILE`;
      }
      if (!-e "$TRUNK/Cpp/Release/xulsword.dll") {&Log("ERROR: libsword did not compile.\n"); die;}

      copy("$TRUNK/Cpp/Release/xulsword.dll", $do);
      $CompiledAlready = 1;

      chdir("$TRUNK/build");
    }
    else {copy("$TRUNK/Cpp/Release/xulsword.dll", $do);}
  }
  else {&Log("ERROR: Please add a compile script for your platform.\n");}
}

sub writePreferences($\%$) {
  my $do = shift;
  my $pP = shift;
  my $debug = shift;

  &Log("----> Writing preferences.\n");
  
  foreach my $p (sort keys %{$pP}) {
    if (!$pP->{$p}) {next;}
    my $pref = $p;
    if ($pref !~ s/^\((.*?)\)\://) {&Log("ERROR: malformed pref entry \"$pref\"\n"); next;}
    my $fn = $1;
    if (!$Debug_debug_prefs && $fn eq "debug.js" && !$debug) {next;}
    my $pfile = "$do/defaults/preferences/$fn";
    my $mode = ($prefFiles{$pfile} ? ">>":">").":encoding(UTF-8)";
    open(PREF, $mode, $pfile) || die "Could not open pref file \"$pfile\"\n";
    my $q = '"';
    if ($pP->{$p} =~ s/^.*?(true|false).*?$/my $b=$1; $b=lc($b);/ie) {$q = "";}
    if ($pref =~ /^HiddenTexts/) {$pP->{$p} =~ s/,/\;/; $pP->{$p} =~ s/\s+//; $pP->{$p}.=";"}
    print PREF "pref(\"$pref\", $q".$pP->{$p}."$q);\n";
    close(PREF);
    $prefFiles{$pfile}++;
  }
}

sub copyExtensionFiles($\@$$$) {
  my $do = shift;
  my $manifestP = shift;
  my @locales = split(/\s*,\s*/, shift);
  my $makeDevelopment = shift;
  my $isFFextension = shift;

  &Log("----> Copying Firefox extension files.\n");
  my $skip = "(\\.svn".($isFFextension ? "":"|install.rdf").")";
  &copy_dir("$TRUNK/xul/extension", $do, "", $skip);
  
  if (opendir(COMP, "$do/components")) {
    my @comps = readdir(COMP);
    close(COMP);
    foreach my $comp (@comps) {
      if ($comp =~ /\.manifest$/i) {
        push(@{$manifestP}, "manifest components/$comp");
      }
    }
  }

  if ($makeDevelopment) {
    push(@{$manifestP}, "content xulsword file:../../../xul/content/");
    push(@{$manifestP}, "locale xulsword en-US file:../../../xul/locale/en-US/");
    push(@{$manifestP}, "skin xulsword skin file:../../../xul/skin/");
    push(@{$manifestP}, "content xsglobal file:../../../xul/content/global/");
    push(@{$manifestP}, "locale xsglobal en-US file:../../../xul/locale/en-US/global/");
    push(@{$manifestP}, "skin xsglobal skin file:../../../xul/skin/global/");
    push(@{$manifestP}, "content xsmozapps file:../../../xul/content/mozapps/");
    push(@{$manifestP}, "locale xsmozapps en-US file:../../../xul/locale/en-US/mozapps/");
    push(@{$manifestP}, "skin xsmozapps skin file:../../../xul/skin/mozapps/");
    push(@{$manifestP}, "locale branding en-US file:../../../xul/locale/branding/");
    push(@{$manifestP}, "content branding file:../../../xul/content/branding/");
    push(@{$manifestP}, "overlay chrome://xulsword/content/xulsword.xul chrome://xulsword/content/debug-overlay.xul");
    &copy_dir("$TRUNK/xul/distribution", "$do/distribution", "", "\\.svn");
  }
  else {
    push(@{$manifestP}, "content xulsword jar:chrome/content.jar!/");
    push(@{$manifestP}, "locale xulsword en-US jar:chrome/en-US.jar!/");
    push(@{$manifestP}, "skin xulsword skin jar:chrome/skin.jar!/");
    push(@{$manifestP}, "content xsglobal jar:chrome/content.jar!/global/");
    push(@{$manifestP}, "locale xsglobal en-US jar:chrome/en-US.jar!/global/");
    push(@{$manifestP}, "skin xsglobal skin jar:chrome/skin.jar!/global/");
    push(@{$manifestP}, "content xsmozapps jar:chrome/content.jar!/mozapps/");
    push(@{$manifestP}, "locale xsmozapps en-US jar:chrome/en-US.jar!/mozapps/");
    push(@{$manifestP}, "skin xsmozapps skin jar:chrome/skin.jar!/mozapps/");
    push(@{$manifestP}, "locale branding en-US jar:chrome/en-US.jar!/branding/");
    push(@{$manifestP}, "content branding jar:chrome/content.jar!/branding/");

    &Log("----> Creating JAR files.\n");
    &makeZIP("$do/chrome/content.jar", "$TRUNK/xul/content");
    &makeZIP("$do/chrome/en-US.jar", "$TRUNK/xul/locale/en-US");
    &makeZIP("$do/chrome/skin.jar", "$TRUNK/xul/skin");
    
    for my $loc (@locales) {
      if (!-e "$XulswordExtras/localeDev/$loc/locale-skin") {next;}
      &Log("----> Including $loc locale-skin in skin.jar.\n");
      print OUTF "skin localeskin $locale $manpath/skin/\n";
      &makeZIP("$do/chrome/skin.jar", "$XulswordExtras/localeDev/$loc/locale-skin", 1);
    }
  }

}

sub copyXulRunnerFiles($) {
  my $do = shift;
  &Log("----> Copying xulrunner files.\n");
  my $skip = "(xulrunner\-stub\.exe";
  if ("$^O" =~ /MSWin32/i) {
    # skip undeeded stuff: 2+1.9+1.9+0.6+0.4+0.36+0.25+0.12+0.1++0.1 ~ 8MB
    $skip .= "|dictionaries|";
    $skip .= "D3DCompiler_43.dll|";
    $skip .= "d3dx9_43.dll|";
    $skip .= "js.exe|";
    $skip .= "libGLESv2.dll|";
    $skip .= "nssckbi.dll|";
    $skip .= "freebl3.dll|";
    $skip .= "updater.exe|";
    $skip .= "crashreporter.exe|";
    $skip .= "nssdbm3.dll|";
    $skip .= "libEGL.dll|";
    $skip .= "xpcshell.exe|";
    $skip .= "IA2Marshal.dll";
  }

  $skip .= ")";
  
  if (!-e $XULRunner) {&Log("ERROR: No xulrunner directory: \"$XULRunner\".\n"); die;}
  copy_dir($XULRunner, $do, "", $skip);
  move("$do/xulrunner.exe", "$do/$Xsprocess");
}

sub writeApplicationINI($$) {
  my $do = shift;
  my $buildTypeID = shift;

  &Log("----> Writing application.ini.\n");
  @d = localtime(time);
  $BuildID = sprintf("%02d%02d%02d", ($d[5]%100), ($d[4]+1), $d[3]);
  $BuildID .= $buildTypeID;
  open(INI, ">:encoding(UTF-8)", "$do/application.ini") || die;
  print INI "[App]\n";
  print INI "Vendor=$Vendor\n";
  print INI "Name=$Name\n";
  print INI "Version=$Version\n";
  print INI "ID=xulsword\@xulsword.org\n";
  print INI "BuildID=$BuildID\n\n";
  print INI "[Gecko]\n";
  print INI "MinVersion=$GeckoMinVersion\n";
  print INI "MaxVersion=$GeckoMaxVersion\n\n";
  print INI "[XRE]\n";
  print INI "EnableExtensionManager=1\n";
  close(INI);
}

sub includeModules($\@$$) {
  my @modules = split(/\s*,\s*/, shift);
  my $repsP = shift;
  my $do = shift;
  my $includeIndexes = shift;
  
  &Log("----> Copying SWORD modules.\n");
  $includeIndexes = ($includeIndexes=~/true/i ? 1:0);

  my $path;
  foreach my $mod (@modules) {
    foreach my $di (@{$repsP}) {
      $di =~ s/(\$\w+)/my $e=$1; $e=eval($e)/eg;
      $path = "$di/mods.d/".lc($mod).".conf";
      if (-e $path) {last;}
    }
    if (!-e $path) {&Log("ERROR: could not locate conf for module $mod\n"); next;}
    undef(%conf);
    &getInfoFromConf($path, \%conf);
    if (!$conf{"DataPath"}) {&Log("ERROR: could not read conf file $path\n"); next;}
    my $mpath = $path;
    $mpath =~ s/mods\.d[\\\/][^\\\/]*$//;
    $mpath .= $conf{"DataPath"};
    if (!-e $mpath) {&Log("ERROR: module $mod files not found in $mpath.\n"); next;}
    if ($includeIndexes && !-e "$mpath/lucene") {&Log("ERROR: search index requested but is not available.\n");}
    my $dfilter = ($includeIndexes ? "":"lucene");
    my $confmd = "$do/mods.d";
    if (!-e $confmd) {make_path($confmd);}
    my $confd = "$confmd/".lc($mod).".conf";
    my $modfd = "$do/".$conf{"DataPath"};
    if (-e $confd) {unlink($confd);}
    if ($modfd =~ /modules/ && -e $modfd) {remove_tree($modfd);}
    copy_dir($mpath, $modfd, "", $dfilter);
    copy($path, $confd);
  }
}

sub writeManifest(\@$) {
  my $maP = shift;
  my $od = shift;
  
  open(MAN, ">>:encoding(UTF-8)", "$od/chrome.manifest") || die "Could not open chrome manifest \"$od/chrome.manifest\"\n";
  opendir(CHROME, "$od/chrome") || die "Could not open chrome directory \"$od/chrome\"\n";
  @files = readdir(CHROME);
  closedir(CHROME);
  foreach my $file (@files) {
    if ($file =~ /\.manifest/) {print MAN "manifest chrome/$file\n";}
  }
  foreach my $e (@{$maP}) {print MAN "$e\n";}
  close(MAN);
}


sub compileStartup($) {
  my $do = shift;
  my $rd;
  if ($do eq $PORTABLE)  {$rd = "runPortable";}
  else {$rd = "runMK";}

  &Log("----> Compiling startup stub.\n");
  remove_tree("$TRUNK/Cpp/$rd/Release");
  chdir("$TRUNK/Cpp/$rd");
  `call Compile.bat >> $LOGFILE`;
  chdir("$TRUNK/build");

  copy("$TRUNK/Cpp/$rd/Release/$rd.exe", "$do/$Executable");
}

sub writeInstallerAppInfo($) {
  my $of = shift;
  &Log("----> Writing installer application info script.\n");
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
  &Log("----> Writing installer locale script.\n");
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
  &Log("----> Writing installer uninstall script.\n");
  my $newInstalls = "NewLocales;"; # don't list any locales- language menu should not open after setup install
  $newInstalls .= "NewModules";
  if (@modules) {$newInstalls .= ";".join(";", @modules);}

  open(OUTF, ">:encoding(UTF-8)", $of) || die;
  print OUTF "SaveStringToFile(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\newInstalls.txt'), '$newInstalls', False);\n";
  foreach my $mod (@modules) {
    undef(%conf);
    &getInfoFromConf("$md/mods.d/".lc($mod).".conf", \%conf);
    print OUTF "DelTree(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\".$conf{"DataPath"}."'), True, True, True);\n";
    print OUTF "DeleteFile(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\mods.d\\".lc($mod).".conf'));\n";
  }
  close(OUTF);
}

sub writeRunScript($$$) {
  my $name = shift;
  my $rd = shift;
  my $type = shift;

  &Log("----> Writing run script.\n");

  my $s = "./run_$name-$type.pl";

  if ("$^O" =~ /MSWin32/i) {
    open(SCR, ">:encoding(UTF-8)", $s) || die;
    print SCR "#!/usr/bin/perl\n";
    if ($type eq "dev") {
      print SCR "chdir(\"".$DEVELOPMENT."\");\n";
      print SCR "`start /wait $Name-srv.exe --app application.ini -jsconsole -console`;\n";
    }
    elsif ($type eq "port") {
      print SCR "chdir(\"".$PORTABLE."\");\n";
      print SCR "`$Name.exe`;\n";
    }
    elsif ($type eq "setup") {
      &writeWindowsRegistryScript();
      print SCR "`\"$INSTALLER/$Name.exe\"`;\n";
    }
    close(SCR);
  }
  else {&Log("ERROR: Please add run scripts for your platform.\n");}
}

sub writeWindowsRegistryScript() {
  &Log("----> Writing Windows registry script.\n");
  if (!-e "$TRUNK/build/autogen") {mkdir "$TRUNK/build/autogen";}
  open (REG, ">:encoding(UTF-8)", "$TRUNK/build/autogen/setRegistry.reg") || die;
  my $id = "$OutputDirectory/toCDROM/Install/setup"; $id =~ s/[\\\/]/\\\\/g;
  my $rd = "$INSTALLER"; $rd =~ s/[\\\/]/\\\\/g;
  my $ad = "$OutputDirectory/audio"; $ad =~ s/[\\\/]/\\\\/g;
  print REG "Windows Registry Editor Version 5.00\n";
  print REG "[HKEY_LOCAL_MACHINE\\SOFTWARE\\$Vendor\\$Name]\n";
  print REG "\"InstallDrive\"=\"$id\"\n";
  print REG "\"RunDir\"=\"$rd\"\n";
  print REG "\"AudioDir\"=\"$ad\"\n";
  print REG "\"Version\"=\"$Version\"\n";
}

sub processLocales($\@$) {
  my @locales = split(/\s*,\s*/, shift);
  my $manifestP = shift;
  my $od = shift;
  
  &Log("----> Processing requested locales.\n");
  foreach my $loc (@locales) {
    if ($loc eq "en-US") {next;}

    # create locale jar file
    if (!$haveLocale{$loc}) {
      &createLocale($loc);
      $haveLocale{$loc} = 1;
    }
    copy("$TRUNK/build-files/locales/$loc.jar", "$od/chrome");
    copy("$XulswordExtras/localeDev/$loc/$loc.rdf", "$od/defaults/");
    
    # write locale manifest info
    push(@{$manifestP}, "# xulswordVersion=3.0\n");
    push(@{$manifestP}, "# minMKVersion=2.9\n");
    push(@{$manifestP}, "locale xulsword $loc jar:chrome/$loc.jar!/xulsword/");
    push(@{$manifestP}, "locale xsglobal $loc jar:chrome/$loc.jar!/global/");
    push(@{$manifestP}, "locale xsmozapps $loc jar:chrome/$loc.jar!/mozapps/");
    if (-e "$XulswordExtras/localeDev/$loc/text-skin") {
      push(@{$manifestP}, "skin localeskin $loc jar:chrome/$loc.jar!/skin/");
    }
  }
}

sub createLocale($) {
  my $locale = shift;

  &Log("----> Creating locale $locale\n");

  # get UI info
  my $firefox;
  if (open(INF, "<$XulswordExtras/localeDev/$locale/UI-$locale.txt")) {
    while (<INF>) {
      if ($_ =~ /Firefox_locale=\s*([^,]+)/) {$firefox = $1;}
      #if ($_ =~ /Version=\s*([^,]+)/) {$version = $1;}
    }
    close(INF);
  }
  else {
    &Log("ERROR: Requested locale not found: \"$XulswordExtras/localeDev/$locale/UI-$locale.txt\".\n");
    return;
  }
  
  # recreate xulsword locale from UI source and report if the log file changes
  move("$XulswordExtras/localeDev/$locale/code_log.txt", "$XulswordExtras/localeDev/$locale/code_log-bak.txt");
  
  system("$TRUNK/localeDev/UI-code.pl", $TRUNK, $XulswordExtras, $locale);
  
  if (compare("$XulswordExtras/localeDev/$locale/code_log.txt", "$XulswordExtras/localeDev/$locale/code_log-bak.txt") != 0) {
    &Log("WARNING: $locale LOG FILE HAS CHANGED. PLEASE CHECK IT: \"$XulswordExtras/localeDev/$locale/code_log.txt\".\n");
  }
  unlink("$XulswordExtras/localeDev/$locale/code_log-bak.txt");
  
  # determine the Firefox locale to use as backup, and report
  if (!$firefox) {
    &Log("WARNING: Defaulting to en-US for locale $locale.\n");
    $firefox = "en-US";
  }
  elsif (!-e "$XulswordExtras/localeDev/Firefox3/$firefox") {
    &Log("WARNING: Requested firefox locale not found in \"$XulswordExtras/localeDev/Firefox3/$firefox\"\n");
    $firefox = "en-US";
  }
  if (!-e "$XulswordExtras/localeDev/Firefox3/$firefox") {
    &log("ERROR: Default firefox locale not found in \"$XulswordExtras/localeDev/Firefox3/$firefox\".\n");
  }
  
  # make locale jar file
  if (-e "$TRUNK/build-files/locales/$locale.jar") {unlink("$TRUNK/build-files/locales/$locale.jar");}
  &makeZIP("$TRUNK/build-files/locales/$locale.jar", "$XulswordExtras/localeDev/$locale/locale");
  &makeZIP("$TRUNK/build-files/locales/$locale.jar", "$XulswordExtras/localeDev/Firefox3/$firefox/locale/$firefox/global", 1);
  &makeZIP("$TRUNK/build-files/locales/$locale.jar", "$XulswordExtras/localeDev/Firefox3/$firefox/locale/$firefox/mozapps", 1);
  if (-e "$XulswordExtras/localeDev/$locale/text-skin") {
    &makeZIP("$TRUNK/build-files/locales/$locale.jar", "$XulswordExtras/localeDev/$locale/text-skin", 1);
  }
}

sub packageWindowsSetup($) {
  my $is = shift;

  &Log("----> Creating Windows setup installer.\n");

  my $id = $is;
  $id =~ s/[\\\/][^\\\/]+$//;
  if (!-e $is) {&Log("ERROR: installer script $is not found.\n"); return;}

  my $resdir = "$OutputDirectory/$Name-Install-$Version";
  if (!-e $resdir) {make_path($resdir);}

  if (!chdir($id)) {&Log("ERROR: Could not cd into \"$id\".\n"); die;}
  my $isp = `echo %ProgramFiles%/Inno Setup 5/ISCC.exe`;
  chomp($isp);
  
  if (!-e $isp) {
    &Log("ERROR: Inno Setup 5 (Unicode) is not installed.\n");
    die;
  }
  `"%ProgramFiles%/Inno Setup 5/ISCC.exe" "$is" > "$resdir/file_log.txt"`;
  chdir("$TRUNK/build");
}

sub packagePortable($$) {
  my $id = shift;
  my $od = shift;

  &cleanDir($od);
  $of = "$od/$Name Portable-$Version.zip";
  
  &Log("----> Making portable zip package.\n");
  if (-e $of) {unlink($of);}
  &makeZIP($of, $id, 0, "file_log.txt");
}

sub packageFFExtension($$) {
  my $id = shift;
  my $od = shift;

  &cleanDir($od);
  $of = "$od/$Name-$Version"."_Firefox(win).xpi";
  
  &Log("----> Making extension xpt package.\n");
  if (-e $of) {unlink($of);}
  &makeZIP($of, $id, 0, "file_log.txt");
}