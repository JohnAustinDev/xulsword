#!/usr/bin/perl

use strict;

my $DIST_PARENT_DIR = shift;
my $IS_DEVELOPMENT = shift;

if (! "$DIST_PARENT_DIR" || ! -d "$DIST_PARENT_DIR/dist/") {
  print "Usage: build.sh DIST_PARENT_DIR [IS_DEVELOPMENT]";
  print "ERROR: Not a directory: $DIST_PARENT_DIR/dist";
  exit 1;
}

if ("$DIST_PARENT_DIR" =~ /^\./) {
  $DIST_PARENT_DIR=`pwd` . "/./$DIST_PARENT_DIR";
}

{ my $path = $0; $path =~ s/\/[^\/]+$//; chdir("$path/../../.."); }
my $xulsword = `pwd`; chomp $xulsword;
`rm "$DIST_PARENT_DIR/dist/"*`;
`rm -rf "$xulsword/build/app/dist/"*`;

# Sourcing for environment variables does not work in Perl, so a wrapper
# build.sh must be used to set the environment.
# doesn't work -> `source ./setenv`;

if ("$IS_DEVELOPMENT" eq "1") {
  open(YARN, "yarn webpack --env development --env webappClients --env library |");
} else {
  open(YARN, "yarn webpack --env production --env webappClients --env library |");
}
while (<YARN>) { print $_;}
close(YARN);

if ("$?" eq "0") {
  my $dist = "$DIST_PARENT_DIR/dist";
  # Copy library (analytics) js to dist
  my $cmd = "cp $xulsword/build/webapp/dist/library/* '$dist'";
  print $cmd . "\n";
  `$cmd`;
  # Copy webappClients js to dist
  $cmd = "cp $xulsword/build/webapp/dist/webappClients/* '$dist'";
  print $cmd . "\n";
  `$cmd`;
  # Copy analytics TypeScript to dist
  $cmd = "yarn tsc --lib es2017,dom --declaration --emitDeclarationOnly $xulsword/src/analytics.ts";
  print $cmd . "\n";
  `$cmd`;
  $cmd = "mv $xulsword/src/analytics.d.ts '$dist'";
  print $cmd . "\n";
  `$cmd`;
  my $libs = "ibt.libraries.yml";
  chdir "$DIST_PARENT_DIR" || die "ERROR: Could not cd to $DIST_PARENT_DIR.\n:";
  if (-e "$libs") {
    opendir(JSF, "$dist") || die "ERROR: Could not open directory $dist.\n";
    my @files = readdir(JSF);
    closedir(JSF);
    my $file;
    foreach my $bundle ('widgets', 'bibleBrowser', 'runtime', 'vendors', 'analytics') {
      foreach my $f (@files) {
        if ($f =~ /^${bundle}_.*\.js(\.(gz|br))?$/) {
          $file = $f;
          open(INF, "<:encoding(UTF-8)", "$libs") || die;
          open(OUTF, ">:encoding(UTF-8)", "$libs.tmp") || die;
          while(<INF>) {
            s/(?<=\bdist\/)${bundle}_.*\.js(\.(gz|br))?(?=:)/$file/;
            print OUTF $_;
          }
          close(INF); close(OUTF); `mv "$libs.tmp" "$libs"`;
        }
      }
    }
  } else {
    die "ERROR: libraries.yml does not exist at $libs.\n";
  }
} else {
  die "ERROR: react build failed.\n";
}
