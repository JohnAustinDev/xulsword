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
$OutputDirectory = File::Spec->rel2abs("../build-out");
require "$TRUNK/build/script/common.pl";

$SETTING = shift;
&readSettingsFiles(\%Prefs);

$WINprocess = "$Executable-srv.exe";
@ModRepos = ($ModuleRepository1, $ModuleRepository2);

if ("$^O" =~ /MSWin32/i) {$PLATFORM = "WINNT_x86-msvc";}
elsif ("$^O" =~ /linux/i) {
  $PLATFORM = "Linux_x86";
  if (`uname -m` eq "x86_64\n") {$PLATFORM .= "_64";}
  $PLATFORM .= "-gcc3";
}
else {&Log("ERROR: Please add Firefox Extension platform identifier for your platform.\n");}

# assign our build ID
@D = localtime(time);

&Log("----> Getting file paths.\n");
if ($OutputDirectory =~ /^\./) {
  $OutputDirectory = File::Spec->rel2abs($OutputDirectory);
}
if (!-e $OutputDirectory) {make_path($OutputDirectory);}
if (!-e "$TRUNK/build-files/$Name") {make_path("$TRUNK/build-files/$Name");}

# assign our Appdata and RESOURCES paths
if ("$^O" =~ /MSWin32/i) {
  $Appdata = `Set APPDATA`; $Appdata =~ s/APPDATA=(.*?)\s*$/$1/i;
  $RESOURCES = "$Appdata/$Vendor/$Name/Profiles/resources";
}
elsif ("$^O" =~ /linux/i) {
  $Appdata = `echo \$HOME`; $Appdata =~ s/^\s*(.*?)\s*$/$1/;
  $RESOURCES = "$Appdata/.".lc($Vendor)."/".lc($Name)."/resources";
}
else {&Log("ERROR: Please add assignment to application directory of your platform\n");}

# assign the output root path for each type of build
$DEVELOPMENT="$TRUNK/build-files/$Name/development";
$INSTALLER="$TRUNK/build-files/$Name/setup";
$FFEXTENSION="$TRUNK/build-files/$Name/xulsword\@xulsword.org";
$PORTABLE="$TRUNK/build-files/$Name/portable";

# DEVELOPMENT ENVIRONMENT
if ($MakeDevelopment =~ /true/i) {
  &Log("\n----> BUILDING DEVELOPMENT ENVIRONMENT\n");
  undef(%Prefs); &readSettingsFiles(\%Prefs);
  # "D" in BuildID identifies this as being a development version
  $BuildID = sprintf("%02d%02d%02d_%dD", ($D[5]%100), ($D[4]+1), $D[3], &get_SVN_rev());
  if (-e $DEVELOPMENT) {&cleanDir($DEVELOPMENT);}
  else {make_path($DEVELOPMENT);}
  make_path("$DEVELOPMENT/xulsword");
  # Linux uses dynamic linking to SWORD, not static
  &compileLibSword("$DEVELOPMENT/xulsword", ("$^O" =~ /MSWin32/i ? 1:0));
  my @manifest;
  &copyXulswordFiles("$DEVELOPMENT/xulsword", \@manifest, $IncludeLocales, 1, 0);
  if ($FirstRunXSM) {&includeFirstRunXSM("$DEVELOPMENT/xulsword/defaults", \%Prefs, $FirstRunXSM);}
  # Windows uses a custom local XULRunner installation, but Linux is assumed 
  # to have a recent Firefox installation available to use at runtime with
  # the -app command line flag. Some versions of Windows Firefox do not
  # support the -app flag, so a XULRunner runtime is required.
  if ("$^O" =~ /MSWin32/i) {
    make_path("$DEVELOPMENT/xulrunner");
    &copyFirefoxFiles("$DEVELOPMENT/xulrunner");
  }
  # Set our startup location...
  $Prefs{"(prefs.js):toolkit.defaultChromeURI"} = "chrome://xulsword/content/startup/splash.xul";
  $Prefs{"(prefs.js):extensions.xulsword.DontShowExceptionDialog"} = "false";
  &writePreferences("$DEVELOPMENT/xulsword", \%Prefs, 1);
  &writeApplicationINI("$DEVELOPMENT/xulsword");
  &includeModules($RESOURCES, $IncludeModules, \@ModRepos, $IncludeSearchIndexes);
  &includeLocales("$DEVELOPMENT/xulsword", $IncludeLocales, \@manifest, 0);
  &writeManifest("$DEVELOPMENT/xulsword", \@manifest);
  &writeRunScript("$DEVELOPMENT/xulsword", "dev");
}

# FIREFOX EXTENSION
if ($MakeFFextension =~ /true/i) {
  &Log("\n----> BUILDING FIREFOX EXTENSION\n");
  undef(%Prefs); &readSettingsFiles(\%Prefs);
  # "E" in BuildID identifies this as being a Firefox extension
  $BuildID = sprintf("%02d%02d%02d_%dE", ($D[5]%100), ($D[4]+1), $D[3], &get_SVN_rev());
  if (-e $FFEXTENSION) {&cleanDir($FFEXTENSION);}
  else {make_path($FFEXTENSION);}
  &compileLibSword($FFEXTENSION, 1);
  my @manifest;
  # the Firefox extension needs a Firefox overlay to put a startup button in the tools menu
  push(@manifest, "overlay chrome://browser/content/browser.xul chrome://xulsword/content/startup/startup-overlay.xul");
  push(@manifest, "overlay chrome://browser/content/browser.xul chrome://xulsword/content/startup/extension-overlay.xul");
  &copyXulswordFiles($FFEXTENSION, \@manifest, $IncludeLocales, 0, 1);
  if ($FirstRunXSM) {&includeFirstRunXSM("$FFEXTENSION/defaults", \%Prefs, $FirstRunXSM);}
  $Prefs{"(prefs.js):toolkit.defaultChromeURI"} = ""; # undo any previous setting
  $Prefs{"(prefs.js):extensions.xulsword.DontShowExceptionDialog"} = "true";
  $Prefs{"(language.js):general.useragent.locale"} = ""; # can't overwrite the Firefox setting
  &writePreferences($FFEXTENSION, \%Prefs);
  &includeModules("$FFEXTENSION/resources", $IncludeModules, \@ModRepos, $IncludeSearchIndexes);
  &includeLocales($FFEXTENSION, $IncludeLocales, \@manifest, 1);
  &writeManifest($FFEXTENSION, \@manifest);
  &writeExtensionInstallManifest($FFEXTENSION);
  &packageFFExtension("$FFEXTENSION/*", "$OutputDirectory/$Name-Extension-$Version");
}

# PORTABLE VERSION
if ($MakePortable =~ /true/i) {
  &Log("\n----> BUILDING PORTABLE VERSION\n");
  undef(%Prefs); &readSettingsFiles(\%Prefs);
  # "P" in BuildID identifies this as being a portable version
  $BuildID = sprintf("%02d%02d%02d_%dP", ($D[5]%100), ($D[4]+1), $D[3], &get_SVN_rev());
  my $intdir = ("$^O" =~ /linux/i ? "":"/$Name-Portable-$Version");
  my $rundir = $PORTABLE.$intdir;
  if (-e $PORTABLE) {&cleanDir($PORTABLE);}
  else {make_path("$rundir/$Name");}
  make_path("$rundir/$Name/xulsword");
  if ("$^O" =~ /MSWin32/i) {make_path("$rundir/$Name/xulrunner");}
  make_path("$rundir/$Name/resources");
  make_path("$rundir/$Name/profile");
  &compileLibSword("$rundir/$Name/xulsword", 1);
  my @manifest;
  &copyXulswordFiles("$rundir/$Name/xulsword", \@manifest, $IncludeLocales, 0, 0);
  if ($FirstRunXSM) {&includeFirstRunXSM("$rundir/$Name/xulsword/defaults", \%Prefs, $FirstRunXSM);}
  if ("$^O" =~ /MSWin32/i) {&copyFirefoxFiles("$rundir/$Name/xulrunner");}
  # Set our startup location...
  $Prefs{"(prefs.js):toolkit.defaultChromeURI"} = "chrome://xulsword/content/startup/splash.xul";
  $Prefs{"(prefs.js):extensions.xulsword.DontShowExceptionDialog"} = "false";
  &writePreferences("$rundir/$Name/xulsword", \%Prefs);
  &writeApplicationINI("$rundir/$Name/xulsword");
  if ("$^O" =~ /MSWin32/i) {&compileWindowsStartup($rundir, 1);}
  &includeModules("$rundir/$Name/resources", $IncludeModules, \@ModRepos, $IncludeSearchIndexes);
  &includeLocales("$rundir/$Name/xulsword", $IncludeLocales, \@manifest, 0);
  &writeManifest("$rundir/$Name/xulsword", \@manifest);
  open(NIN, ">:encoding(UTF-8)", "$rundir/$Name/resources/newInstalls.txt") || die;
  print NIN "NewLocales;en-US\n"; # this opens language menu on first run
  close(NIN);
  &writeRunScript($rundir, "portable");
  &packagePortable("$PORTABLE/*", "$OutputDirectory/$Name-Portable-$Version");
}

# WINDOWS INSTALLER VERSION
if ($MakeSetup =~ /true/i) {
  &Log("\n----> BUILDING PROGRAM SETUP INSTALLER\n");
  undef(%Prefs); &readSettingsFiles(\%Prefs);
  if ("$^O" !~ /MSWin32/i) {
    &Log("ERROR: Setup Installer has not been implemented for your platform.\n");
     die;
  }
  # "S" in BuildID identifies this as being Setup Installer version
  $BuildID = sprintf("%02d%02d%02d_%dS", ($D[5]%100), ($D[4]+1), $D[3], &get_SVN_rev());
  
  if (-e $INSTALLER) {&cleanDir($INSTALLER);}
  else {make_path($INSTALLER);}
  # Delete RESOURCES because this dir is copied into Setup by the setup compiler
  if (-e $RESOURCES) {&cleanDir($RESOURCES);}
  else {make_path($RESOURCES);}
  
  make_path("$INSTALLER/xulsword");
  make_path("$INSTALLER/xulrunner");
  &compileLibSword("$INSTALLER/xulsword", 1);
  my @manifest;
  &copyXulswordFiles("$INSTALLER/xulsword", \@manifest, $IncludeLocales, 0, 0);
  if ($FirstRunXSM) {&includeFirstRunXSM("$INSTALLER/xulsword/defaults", \%Prefs, $FirstRunXSM);}
  &copyFirefoxFiles("$INSTALLER/xulrunner");
  # Set our startup location...
  $Prefs{"(prefs.js):toolkit.defaultChromeURI"} = "chrome://xulsword/content/startup/splash.xul";
  $Prefs{"(prefs.js):extensions.xulsword.DontShowExceptionDialog"} = "false";
  &writePreferences("$INSTALLER/xulsword", \%Prefs);
  &writeApplicationINI("$INSTALLER/xulsword");
  &compileWindowsStartup($INSTALLER, 0);
  &includeModules($RESOURCES, $IncludeModules, \@ModRepos, $IncludeSearchIndexes);
  &includeLocales("$INSTALLER/xulsword", $IncludeLocales, \@manifest, 0);
  &writeManifest("$INSTALLER/xulsword", \@manifest);
  &writeRunScript($INSTALLER, "setup");

  # package everything into the Setup Installer
  my $autogen = "$XulswordExtras/installer/autogen";
  if (-e $autogen) {&cleanDir($autogen);}
  make_path($autogen);
  &writeInstallerAppInfo("$autogen/appinfo.iss");
  &writeInstallerLocaleinfo("$autogen/localeinfo.iss", $IncludeLocales, \%Prefs)
  &writeInstallerModuleUninstall("$autogen/uninstall.iss", $RESOURCES, $IncludeModules, $IncludeLocales);
  &packageWindowsSetup("$XulswordExtras/installer/scriptProduction.iss");

}

&Log("FINISHED BUILDING\n");
print "Press enter to close...\n";
$p = <>;

################################################################################
################################################################################

sub writeCompileDeps($) {
  my $isPortable = shift;
  
  # remove any previously generated compile deps
  if (-e "$TRUNK/Cpp/src/include/appInfo.h") {unlink("$TRUNK/Cpp/src/include/appInfo.h");}
  if (-e "$TRUNK/Cpp/src/include/keygen.h") {unlink("$TRUNK/Cpp/src/include/keygen.h");}
  if (-e "$TRUNK/Cpp/windows/Versions.bat") {unlink("$TRUNK/Cpp/windows/Versions.bat");}
  
  if ($UseSecurityModule =~ /true/i) {
    if (!-e $KeyGenPath) {
      &Log("ERROR: You cannot use the security module without supplying a key generator. (UseSecurityModule=true, KeyGenPath=???)\n");
      die;
    }
    open(INFO, ">:encoding(UTF-8)", "$TRUNK/Cpp/src/include/keygen.h") || die;
    print INFO "#ifdef _XULSECURITY_\n";
    print INFO "#  include \"$KeyGenPath\"\n";
    print INFO "#endif\n";
    close(INFO);
  }
  
  # the following compiler deps are only needed by Windows
  if ("$^O" !~ /MSWin32/i) {return;}
  
  &Log("----> Writing application info for C++ compiler.\n");
  if (!-e "$TRUNK/Cpp/windows/Release") {mkdir "$TRUNK/Cpp/windows/Release";}
  open(INFO, ">:encoding(UTF-8)", "$TRUNK/Cpp/src/include/appInfo.h") || die;
  if (!$isPortable) {
    print INFO "#define RUN_DIR L\".\\\\xulrunner\"\n";
    # don't use -no-remote because otherwise .xsm and .xsb onclick installation won't work!
    print INFO "#define COMMAND_LINE L\"\\\".\\\\xulrunner\\\\$WINprocess\\\" -app ..\\\\xulsword\\\\application.ini %s\"\n";
  }
  else {
    print INFO "#define RUN_DIR L\".\\\\$Name\\\\xulrunner\"\n";
    # portable version uses local profile directory
    # don't use -no-remote because otherwise .xsm and .xsb onclick installation won't work.
    print INFO "#define COMMAND_LINE L\"\\\".\\\\$Name\\\\xulrunner\\\\$WINprocess\\\" -app ..\\\\xulsword\\\\application.ini -profile ..\\\\profile %s\"\n";
  }
  print INFO "\n// The following are used by cdrun.cpp\n";
  print INFO "#define PROC_NAME L\"$WINprocess\"\n";
  print INFO "#define KEYADDRESS L\"Software\\\\$Vendor\\\\$Name\"\n";
  close(INFO);
  
  &Log("----> Writing path info for C++ compiler.\n");
  if (!-e $SwordSource) {&Log("ERROR: No SWORD source code.\n"); die;}
  if (!-e $CluceneSource) {&Log("ERROR: No Clucene source code.\n"); die;}
  #if (!-e $MicrosoftSDK) {&Log("ERROR: No Microsoft SDK.\n"); die;}
  open(INFO, ">:encoding(UTF-8)", "$TRUNK/Cpp/windows/Versions.bat") || die;
  print INFO "Set clucene=$CluceneSource\n";
  print INFO "Set sword=$SwordSource\n";
  print INFO "Set microsoftsdk=$MicrosoftSDK\n";
  print INFO "Set Name=$Name\n";
  print INFO "Set MKS=$XulswordExtras\n";
  my $t = $TRUNK;
  $t =~ s/\//\\/g;
  print INFO "Set MK=$t\n";
  close(INFO);

}

sub compileLibSword($$) {
  my $do = shift;
  my $staticLinkToSWORD = shift;
  
  &writeCompileDeps();
    
  &Log("----> Compiling libsword binary.\n");
  
  if ("$^O" =~ /MSWin32/i) {
    if (!$staticLinkToSWORD) {
      &Log("WARNING: staticLinkToSWORD=false, but MS-Windows will get static link anyway.\n");
    }
    if (!$CompiledAlready) {
      if (!-e "$TRUNK/Cpp/cluceneMK/windows/lib/Release/libclucene.lib") {
        `call "$TRUNK/Cpp/cluceneMK/windows/lib/Compile.bat" >> $LOGFILE`;
      }
      if (!-e "$TRUNK/Cpp/swordMK/windows/lib/Release/libsword.lib") {
        `call "$TRUNK/Cpp/swordMK/windows/lib/Compile.bat" >> $LOGFILE`;
      }

      if ($UseSecurityModule =~ /true/i) {
        `call "$TRUNK/Cpp/windows/Compile.bat" >> $LOGFILE`;
      }
      else {
        `call "$TRUNK/Cpp/windows/Compile.bat" NOSECURITY >> $LOGFILE`;
      }
      
      if (!-e "$TRUNK/Cpp/windows/Release/xulsword.dll") {&Log("ERROR: libsword did not compile.\n"); die;}
    }
    &copy_file("$TRUNK/Cpp/windows/Release/xulsword.dll", $do);
  }
  elsif ("$^O" =~ /linux/i) {
    if (!$CompiledAlready) {
      chdir("$TRUNK/Cpp");
      if (!-e "$TRUNK/Cpp/Makefile.in") {
        `./autogen.sh >> $LOGFILE 2>&1`;
        `./configure >> $LOGFILE 2>&1`;
      }
      `make clean >> $LOGFILE 2>&1`;
      `make >> $LOGFILE 2>&1`;
      `./staticlib.sh >> $LOGFILE 2>&1`;
      if (!-e "$TRUNK/Cpp/.libs/libxulsword.so") {&Log("ERROR: libxulsword did not compile.\n"); die;}
    }
    if (!$staticLinkToSWORD) {&copy_file("$TRUNK/Cpp/.libs/libxulsword.so", $do);}
    else {
      &copy_file("$TRUNK/Cpp/.libs/libxulswordstatic.so", $do);
      mv("$do/libxulswordstatic.so", "$do/libxulsword.so");
    }
  }
  else {&Log("ERROR: Please add a compile script for your platform.\n");}
  
  $CompiledAlready = 1;
  chdir("$TRUNK/build");
}

sub copyXulswordFiles($\@$$$) {
  my $do = shift;
  my $manifestP = shift;
  my @locales = split(/\s*,\s*/, shift);
  my $makeDevelopment = shift;
  my $isFFextension = shift;

  &Log("----> Copying xulsword installation files.\n");
  my $skip = "(\\.svn".($isFFextension ? "|main-window.ico\$":"").")";
  &copy_dir("$TRUNK/xul/installation", $do, "", $skip);

  # add any copied components to the manifest file
  if (opendir(COMP, "$do/components")) {
    my @comps = readdir(COMP);
    close(COMP);
    foreach my $comp (@comps) {
      if ($comp =~ /\.manifest$/i) {
        push(@{$manifestP}, "manifest components/$comp");
      }
    }
  }
  
  # copy debugger distribution if this is a development build
  if ($makeDevelopment) {
    &copy_dir("$TRUNK/xul/distribution", "$do/distribution", "", "\\.svn");
  }

  # create and copy skin and content jar files (development accesses these  
  # files directly, so these jars aren't necessary for development)
  if (!$makeDevelopment) {
    &Log("----> Creating content and skin JAR files.\n");
    &makeZIP("$do/chrome/content.jar", "$TRUNK/xul/content/*");
    &makeZIP("$do/chrome/skin.jar", "$TRUNK/xul/skin/*");
  
    # add any locale specific skin files to skin.jar
    # NOTE: locale specific skins cannot be used in the Development setup
    # because they override regular skin code files which are accessed
    # directly in the Development setup.
    for my $loc (@locales) {
      my $ldir = "$XulswordExtras/localeDev/$loc";
      if ($loc eq "en-US") {$ldir = "$TRUNK/localeDev/en-US";}
      
      if (-e "$ldir/skin-files") {
        &Log("----> Overwriting skin.jar with $loc skin-files.\n");
        &makeZIP("$do/chrome/skin.jar", "$ldir/skin-files/*", 1);
      }
    }
  }
  
  # branding is necessary for the install manager to work, 
  # but Firefox extensions should never incude branding
  if (!$isFFextension) {
    my $brandDir = "$TRUNK/build-files/$Name/branding";
    make_path($brandDir);

    # these branding files were copied from Firefox 17
    my $brandFile = "$brandDir/brand.dtd";
    if (open(BRANDF, ">:encoding(UTF-8)", $brandFile)) {
      print BRANDF "<!ENTITY brandShortName \"$Name\">\n";
      print BRANDF "<!ENTITY brandFullName \"$Name\">\n";
      print BRANDF "<!ENTITY vendorShortName \"$Vendor\">\n";
      print BRANDF "<!ENTITY trademarkInfo.part1 \"trademark info\">\n";
      close(BRANDF);
    }
    else {&Log("ERROR: Could not open locale branding file:\"".$brandFile."\"\n");}

    $brandFile = "$brandDir/brand.properties";
    if (open(BRANDF, ">:encoding(UTF-8)", $brandFile)) {
      print BRANDF "brandShortName=$Name\n";
      print BRANDF "brandFullName=$Name\n";
      print BRANDF "vendorShortName=$Vendor\n";
      print BRANDF "homePageSingleStartMain=Start Page\n";
      print BRANDF "homePageImport=Import your home page from %S\n";
      print BRANDF "homePageMigrationPageTitle=Home Page Selection\n";
      print BRANDF "homePageMigrationDescription=Please select the home page you wish to use:\n";
      print BRANDF "syncBrandShortName=Sync\n";
      close(BRANDF);
    }
    else {&Log("ERROR: Could not open locale branding file:\"".$brandFile."\"\n");}
    &Log("----> Creating branding.jar file.\n");
    &makeZIP("$do/chrome/branding.jar", "$brandDir/*", 1);
  }

  # add the content, skin, branding etc. to the manifest file
  if (!$isFFextension) {
    push(@{$manifestP}, "content branding jar:chrome/content.jar!/branding/");
  }
  if ($makeDevelopment) {
    push(@{$manifestP}, "content xulsword file:../../../../xul/content/");
    push(@{$manifestP}, "skin xulsword skin file:../../../../xul/skin/");
    push(@{$manifestP}, "skin xsplatform skin file:../../../../xul/skin/common/linux/ os=Linux");
    push(@{$manifestP}, "skin xsplatform skin file:../../../../xul/skin/common/windows/ os=WINNT");
    # development includes the hidden debug overlay
    push(@{$manifestP}, "overlay chrome://xulsword/content/xulsword.xul chrome://xulsword/content/test/debug-overlay.xul");
  }
  else {
    push(@{$manifestP}, "content xulsword jar:chrome/content.jar!/");
    push(@{$manifestP}, "skin xulsword skin jar:chrome/skin.jar!/");
    push(@{$manifestP}, "skin xsplatform skin jar:chrome/skin.jar!/common/linux/ os=Linux");
    push(@{$manifestP}, "skin xsplatform skin jar:chrome/skin.jar!/common/windows/ os=WINNT");
  }

}

sub includeFirstRunXSM($\%$) {
	my $do = shift;
	my $pP = shift;
	my $xsm = shift;
	
	# copy xsm module to output directory
	&copy_file($xsm, $do);
	
	# set pref to do xsm install on first run
	$xsm =~ s/^.*?[\/\\]([^\/\\]*)$/$1/;
	$pP->{"(prefs.js):extensions.xulsword.FirstRunXSM"} = $xsm;
}

sub copyFirefoxFiles($) {
  my $do = shift;
  
  if ("$^O" !~ /MSWin32/i) {
    &Log("ERROR: Custom packaged Firefox is not currently supported on this platform.\n");
    return;
  }
  
  my $EXE = ".exe";
  my $DLL = ".dll";
  
  &Log("----> Copying XULRunner files.\n");

  my $skip = "(";
  #$skip .= "\\S+$EXE|";
  $skip .= "dictionaries";
  $skip .= ")";

  if (!-e $XULRunner) {&Log("ERROR: No directory: \"$XULRunner\".\n"); die;}
  
  &copy_dir($XULRunner, $do, "", $skip);
  &mv("$do/xulrunner.exe", "$do/$WINprocess");

}

sub writePreferences($\%$) {
  my $do = shift;
  my $pP = shift;
  my $debug = shift;

  &Log("----> Writing preferences.\n");

  # NOTE: although nsIXULAppInfo would be the prefered method for xulsword to
  # obtain the following info, prefs must be used instead because extensions 
  # reading nsIXULAppInfo would return info about Firefox rather than xulsword.
  $pP->{"(prefs.js):extensions.xulsword.Vendor"} = $Vendor;
  $pP->{"(prefs.js):extensions.xulsword.Name"} = $Name;
  $pP->{"(prefs.js):extensions.xulsword.Version"} = $Version;
  $pP->{"(prefs.js):extensions.xulsword.BuildID"} = $BuildID;

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
    if ($pP->{$p} =~ /^""$/) {$q = "";} # let Set pref="" pass as is
    print PREF "pref(\"$pref\", $q".$pP->{$p}."$q);\n";
    close(PREF);
    $prefFiles{$pfile}++;
  }
}

sub writeApplicationINI($) {
  my $do = shift;
  
  &Log("----> Writing application.ini.\n");
  open(INI, ">:encoding(UTF-8)", "$do/application.ini") || die;
  print INI "[App]\n";
  print INI "Vendor=$Vendor\n";
  print INI "Name=$Name\n";
  print INI "Version=$Version\n";
  print INI "ID=xulsword\@xulsword.org\n";
  print INI "BuildID=$BuildID\n\n";
  # Although it seems better to specify an exact profile directory so that an
  # installer/uninstaller will always know where it is (or will be), this cannot
  # be done with "Profile=<path-to-profile>" because this directory is only the
  # parent of the profile while the the actual child profile directory still has
  # a random name!
  print INI "[Gecko]\n";
  print INI "MinVersion=$GeckoMinVersion\n";
  print INI "MaxVersion=$GeckoMaxVersion\n\n";
  print INI "[XRE]\n";
  print INI "EnableExtensionManager=1\n";
  close(INI);
}

sub includeModules($$\@$) {
  my $do = shift;
  my @modules = split(/\s*,\s*/, shift);
  my $repsP = shift;
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
    &copy_dir($mpath, $modfd, "", $dfilter);
    &copy_file($path, $confd);
  }
}

sub includeLocales($$\@$) {
  my $od = shift;
  my @locales = split(/\s*,\s*/, shift);
  my $manifestP = shift;
  my $no_xul_overrides = shift;

  &Log("----> Processing requested locales.\n");
  foreach my $loc (@locales) {

  my $ldir = "$XulswordExtras/localeDev/$loc";
  if ($loc eq "en-US") {$ldir = "$TRUNK/localeDev/en-US";}

    # create locale jar file
    if (!$haveLocale{$loc}) {
      &createLocale($loc);
      $haveLocale{$loc} = 1;
    }
    &copy_file("$TRUNK/build-files/locales/$loc/$loc.jar", "$od/chrome");

    # write locale manifest info
    # NOTE: this registers the locale in the xulsword build, but each 
    # locale extension also has its own manifest file
    push(@{$manifestP}, "locale xulsword $loc jar:chrome/$loc.jar!/xulsword/");
    if (!$no_xul_overrides) {
      push(@{$manifestP}, "locale branding $loc jar:chrome/branding.jar!/");
    }
  }

  # Do not override anything if this is a FireFox extension, as this may
  # break FireFox if its version is different than that from which the override
  # files were taken.
  if (!$no_xul_overrides) {

    # override files are copied from a Firefox locale and added to the xulsword locale by UI-code.pl
    # first get override files from UI-MAP
    open(UIMAP, "<:encoding(UTF-8)", "$TRUNK/localeDev/UI-MAP.txt") || die "Cold not open \"$TRUNK/localeDev/UI-MAP.txt\"\n";
    my %OVERRIDES;
    while(<UIMAP>) {
      if ($_ =~ /^([^\:]+\.([^\.\:\s]+))\s*=\s*(chrome\:\/\/.*?)\s*$/) {
        my $xsFile = $1;
        my $ffFile = $3;
        $OVERRIDES{$3} = $1;
      }
    }
    close(UIMAP);
    
    # next check each override and enter allowable overrides into the manifest
    foreach my $override (sort keys %OVERRIDES) {
      
      # never override a file unless the target exists for every locale, 
      # or else the program will break when using any incomplete locale.
      my $haveAllTargets = 1;
      my $loc2;
      foreach $loc2 (@locales) {
        my $ldir = "$XulswordExtras/localeDev/$loc2";
        if ($loc2 eq "en-US") {$ldir = "$TRUNK/localeDev/en-US";}
        if (!-e "$ldir/locale/".$OVERRIDES{$override}) {
          $haveAllTargets = 0;
          &Log("WARNING: override target \"".$OVERRIDES{$override}."\" does not exist in \"$loc2\". Skipping override of \"$override\".\n");
          last;
        }
      }
      if ($haveAllTargets) {
        # don't allow overrides with an incompatible version
        my $version = $OVERRIDES{$override};
        if ($version =~ /\/ff([^\/]+)\//) {
          $version = $1;
          if ($version eq $XULToolkitVersion) {
            my $lp = $OVERRIDES{$override};
            $lp =~ s/^xulsword\///;
            push(@{$manifestP}, "override $override chrome://xulsword/locale/$lp");
          }
        }
      }
    }
  }
}

sub createLocale($) {
  my $locale = shift;

  &Log("----> Creating locale $locale\n");

  my $ldir = "$XulswordExtras/localeDev/$locale";
  if ($locale eq "en-US") {$ldir = "$TRUNK/localeDev/en-US";}

  # recreate xulsword locale from UI source and report if the log file changes
  mv("$ldir/code_log.txt", "$ldir/code_log-bak.txt");

  system("$TRUNK/localeDev/UI-code.pl", $TRUNK, $XulswordExtras, $locale);

  if (compare("$ldir/code_log.txt", "$ldir/code_log-bak.txt") != 0) {
    #&Log("WARNING: $locale LOG FILE HAS CHANGED. PLEASE CHECK IT: \"$ldir/code_log.txt\".\n");
  }
  unlink("$ldir/code_log-bak.txt");
  
  # make locale jar file
  if (-e "$TRUNK/build-files/locales/$locale/$locale.jar") {unlink("$TRUNK/build-files/locales/$locale/$locale.jar");}
  &makeZIP("$TRUNK/build-files/locales/$locale/$locale.jar", "$ldir/locale/*");
  
  # make the locale extension
  system("$TRUNK/localeDev/UI-extension.pl", $TRUNK, $XulswordExtras, $locale);

}

sub writeManifest($\@) {
  my $od = shift;
  my $maP = shift;
  
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

sub writeExtensionInstallManifest($) {
  my $od = shift;
  
  &Log("----> Writing Install Manifest\n");

  open(INM, ">:encoding(UTF-8)", "$od/install.rdf") || die "Could not open \"$od/install.rdf\".\n";
  print INM "<?xml version=\"1.0\"?>\n";
  print INM "\n";
  print INM "<RDF xmlns=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\"\n";
  print INM "     xmlns:em=\"http://www.mozilla.org/2004/em-rdf#\">\n";
  print INM "\n";
  print INM "  <Description about=\"urn:mozilla:install-manifest\">\n";
  print INM "    <em:id>xulsword\@xulsword.org</em:id>\n";
  print INM "    <em:version>$Version</em:version>\n";
  print INM "    <em:type>2</em:type>\n";
  print INM "\n";
  print INM "    <!-- Firefox -->\n";
  print INM "    <em:targetApplication>\n";
  print INM "      <Description>\n";
  print INM "        <em:id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</em:id>\n";
  print INM "        <em:minVersion>$GeckoMinVersion</em:minVersion>\n";
  print INM "        <em:maxVersion>$GeckoMaxVersion</em:maxVersion>\n";
  print INM "      </Description>\n";
  print INM "    </em:targetApplication>\n";
  print INM "\n";
  print INM "    <!-- Front End MetaData -->\n";
  print INM "    <em:name>xulsword</em:name>\n";
  print INM "    <em:description>A Bible reading and study tool.</em:description>\n";
  print INM "    <em:homepageURL>http://code.google.com/p/xulsword</em:homepageURL>\n";
  print INM "    <em:iconURL>chrome://xulsword/skin/icon.png</em:iconURL>\n";
  print INM "    <em:unpack>true</em:unpack>\n";
  print INM "    <em:targetPlatform>$PLATFORM</em:targetPlatform>\n";
  print INM "  </Description>\n";
  print INM "</RDF>\n";
  close(INM);
}

sub writeRunScript($$) {
  my $rundir = shift;
  my $type = shift;

  &Log("----> Writing run script.\n");

  my $s = "$TRUNK/build/run_$Name-$type.pl";
  open(SCR, ">:encoding(UTF-8)", $s) || die;
  
  print SCR "#!/usr/bin/perl\n";

  if ("$^O" =~ /MSWin32/i) {
    if ($type eq "dev") {
      print SCR "chdir(\"".$rundir."\");\n";
      print SCR "`start /wait ../xulrunner/$Name-srv.exe -app application.ini -jsconsole -console -no-remote`;\n";
    }
    else {
      print SCR "chdir(\"".$rundir."\");\n";
      print SCR "`$Executable.exe`;\n";
    }
  }
  elsif ("$^O" =~ /linux/i) {
    if ($type eq "dev") {
      print SCR "`firefox --app $rundir/application.ini -jsconsole -no-remote`;\n";
    }
    else {
      print SCR "chdir(\"".$rundir."\");\n";
      print SCR "`./start-$Name.sh`;\n";
      
      # write the start script too
      my $profile = ($type eq "portable" ? " -profile ./$Name/profile":"");
      if (open(PRUN, ">:encoding(UTF-8)", "$rundir/start-$Name.sh")) {
        print PRUN "#!/bin/bash\n";
        print PRUN "firefox --app ./$Name/xulsword/application.ini$profile -no-remote\n";
        close(PRUN);
        `chmod ug+x "$rundir/start-$Name.sh"`;
      }
      else {&Log("ERROR: Could not open file \"$rundir/start-$Name.sh\"\n");}
      
    }
  }
  else {&Log("ERROR: Please add run scripts for your platform.\n");}
  
  close(SCR);
  if ("$^O" =~ /linux/i) {`chmod ug+x "$s"`}
}

sub compileWindowsStartup($$) {
  my $do = shift;
  my $isPortable = shift;

  &writeCompileDeps($isPortable);
  
  &Log("----> Compiling startup executable.\n");
  
  `call "$TRUNK/Cpp/windows/startup/Compile.bat" >> $LOGFILE`;

  if (!-e "$TRUNK/Cpp/windows/startup/Release/startup.exe") {
    &Log("ERROR: startup.exe did not compile.\n");
    die;
  }
  &copy_file("$TRUNK/Cpp/windows/startup/Release/startup.exe", "$do/$Executable.exe");
}

sub writeInstallerAppInfo($) {
  my $of = shift;
  &Log("----> Writing installer application info script.\n");
  open (ISS, ">:encoding(UTF-8)", $of) || die;
  print ISS "#define MyAppName \"$Name\"\n";
  print ISS "#define MyAppExeName \"$Executable.exe\"\n";
  print ISS "#define MyPublisher \"$Vendor\"\n";
  print ISS "#define MyDecimalVersion \"$Version\"\n";
  print ISS "#define MyVersion \"$Version\"\n";
  print ISS "#define securitymod \"$UseSecurityModule\"\n";
  print ISS "#define HebrewFont \"$IncludeHebrewFont\"\n";
  print ISS "#define MK \"$TRUNK\"\n";
  print ISS "#define MKS \"$XulswordExtras\"\n";
  print ISS "#define MKO \"$OutputDirectory\"\n";
  print ISS "#define APPDATA \"$Appdata\"\n";
  print ISS "#define FirstRunXSM \"$FirstRunXSM\"\n";
  close(ISS);
}

sub writeInstallerLocaleinfo($$\%) {
  my $of = shift;
  my @locales = split(/\s*,\s*/, shift);
  my $prefsP = shift;
  
  &Log("----> Writing installer locale script.\n");
  open(OUTF, ">:encoding(UTF-8)", $of) || die;
  # set any included locales to true
  foreach my $locale (@locales) {
    my $pl = $locale; $pl =~ s/-//g; # iss defines can't use "-"
    print OUTF "#define $pl \"true\"\n";
  }
  print OUTF "#define defLang\"".$prefsP->{"(language.js):general.useragent.locale"}."\"\n";
  close(OUTF);
}

sub writeInstallerModuleUninstall($$$$) {
  my $of = shift;
  my $md = shift;
  my @modules = split(/\s*,\s*/, shift);
  my @locales = split(/\s*,\s*/, shift);

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

sub packageWindowsSetup($) {
  my $is = shift;

  &Log("----> Creating Windows setup installer.\n");

  my $id = $is;
  $id =~ s/[\\\/][^\\\/]+$//;
  if (!-e $is) {&Log("ERROR: installer script $is was not found.\n"); return;}

  my $resdir = "$OutputDirectory/$Name-Setup-$Version";
  if (!-e $resdir) {make_path($resdir);}

  if (!chdir($id)) {&Log("ERROR: Could not cd into \"$id\".\n"); die;}
  my $isp = `echo %ProgramFiles%/Inno Setup 5/ISCC.exe`;
  chomp($isp);
  
  if (!-e $isp) {
    &Log("ERROR: Inno Setup 5 (Unicode) is not installed (did not find: \"%ProgramFiles%/Inno Setup 5/ISCC.exe\").\n");
    die;
  }
  
  `"%ProgramFiles%/Inno Setup 5/ISCC.exe" "$is" > "$resdir/file_log.txt"`;
  
  chdir("$TRUNK/build");
}

sub packagePortable($$) {
  my $id = shift;
  my $od = shift;

  &cleanDir($od);
  my $fname = ("$^O" =~ /linux/i ? "$Name-$PLATFORM-$Version.zip":"$Name Portable-$Version.zip");
  $of = "$od/$fname";
  
  &Log("----> Making portable zip package.\n");
  &makeZIP($of, $id, 0, "file_log.txt");
}

sub packageFFExtension($$) {
  my $id = shift;
  my $od = shift;
  
  &cleanDir($od);
  $of = "$od/$Name"."_Firefox(".$PLATFORM.")-".$Version.".xpi";
  
  &Log("----> Making extension xpt package.\n");
  if (-e $of) {unlink($of);}
  &makeZIP($of, $id, 0, "file_log.txt");
}
