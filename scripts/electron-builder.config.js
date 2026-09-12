'use strict';

const packageJson = require('../package.json');
const { createBuilderConfig } = require('./macos-packaging');
const { resolveElectronVersionOverride } = require('./electron-builder-version');

// electron-builder downloads the framework selected by this top-level option.
// The release workflow sets the override only for the Linux artifact, so macOS
// and Windows continue to use the package.json Electron version.
const electronVersion = resolveElectronVersionOverride();

const config = createBuilderConfig({
  baseConfig: {
    ...packageJson.build,
    ...(electronVersion ? { electronVersion } : {})
  }
});

// electron-builder's getSanitizedVersion() rewrites hyphens to tildes for the
// deb target (0.45.0-rev.24 -> 0.45.0~rev.24).  Debian's comparator sorts "~"
// before nothing, so that tilde version ranks *below* the bare base 0.45.0 and
// dpkg treats the upgrade as "already installed".  Feeding the raw version back
// through fpm keeps the hyphen so Debian parses upstream 0.45.0 / revision
// rev.24, which ranks above both the base and the previous rev.N.  FpmTarget
// appends options.fpm after its sanitized --version and fpm takes the last one.
config.deb = config.deb || {};
config.deb.fpm = ['--version', packageJson.version];

module.exports = config;
