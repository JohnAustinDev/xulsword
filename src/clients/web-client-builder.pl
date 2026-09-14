#!/usr/bin/perl

use strict;

my $DIST_PARENT_DIR = shift;
my $IS_DEVELOPMENT = shift;

if (! "$DIST_PARENT_DIR" || ! -d "$DIST_PARENT_DIR/dist/") {
  print "Usage: builder.pl DIST_PARENT_DIR [IS_DEVELOPMENT]";
  print "ERROR: Not a directory: $DIST_PARENT_DIR/dist";
  exit 1;
}

if ("$DIST_PARENT_DIR" =~ /^\./) {
  $DIST_PARENT_DIR=`pwd` . "/./$DIST_PARENT_DIR";
}

{ my $path = $0; $path =~ s/\/[^\/]+$//; chdir("$path/../.."); }
my $xulsword = `pwd`; chomp $xulsword;
`rm -rf "$DIST_PARENT_DIR/dist/"*`;
`rm -rf "$xulsword/build/webapp/dist/"*`;

# Sourcing for environment variables does not work in Perl, so a wrapper
# web-client-build.sh must be used to set the environment.
# doesn't work -> `source ./setenv`;

if ("$IS_DEVELOPMENT" eq "1") {
  open(YARN, "yarn webpack --env development --env webapp --env widgets --env library |");
} else {
  open(YARN, "yarn webpack --env production --env webapp --env widgets --env library |");
}
while (<YARN>) { print $_;}
close(YARN);

if ("$?" eq "0") {
  my $dist = "$DIST_PARENT_DIR/dist";

  # Copy dist
  my $cmd = "cp -r $xulsword/build/webapp/dist/* '$dist/'";
  print $cmd . "\n";
  `$cmd`;
  # Copy analytics TypeScript to dist
  my $cmd = "yarn tsc --lib es2017,dom --declaration --emitDeclarationOnly $xulsword/src/clients/analytics.ts";
  print $cmd . "\n";
  `$cmd`;
  my $cmd = "mv $xulsword/src/clients/analytics.d.ts '$dist/library'";
  print $cmd . "\n";
  `$cmd`;
  # Copy bibleBrowserParent.js to dist
  my $cmd = "cp $xulsword/src/clients/webapp/bibleBrowserParent.js '$dist/webapp'";
  print $cmd . "\n";
  `$cmd`;
  # Copy head.css to dist
  my $cmd = "cp $xulsword/src/clients/webapp/head.css '$dist/webapp'";
  print $cmd . "\n";
  `$cmd`;
  my $libs = "ibt.libraries.yml";
  chdir "$DIST_PARENT_DIR" || die "ERROR: Could not cd to $DIST_PARENT_DIR.\n:";
  if (-e "$libs") {
    my $file;
    foreach my $dir ('webapp', 'widgets', 'library') {
      opendir(JSF, "$dist/$dir") || die "ERROR: Could not open directory $dist/$dir.\n";
      my @files = readdir(JSF);
      closedir(JSF);
      foreach my $bundle ('webapp', 'widgets', 'runtime', 'vendors', 'analytics') {
        foreach my $f (@files) {
          if ($f =~ /^${bundle}_.*\.js(\.(gz|br))?$/) {
            $file = $f;
            open(INF, "<:encoding(UTF-8)", "$libs") || die;
            open(OUTF, ">:encoding(UTF-8)", "$libs.tmp") || die;
            while(<INF>) {
              s/(?<=\bdist\/${dir}\/)${bundle}_.*\.js(\.(gz|br))?(?=:)/$file/;
              print OUTF $_;
            }
            close(INF); close(OUTF); `mv "$libs.tmp" "$libs"`;
          }
        }
      }
    }
  } else {
    die "ERROR: libraries.yml does not exist at $libs.\n";
  }
} else {
  die "ERROR: react build failed.\n";
}
