'use strict';

// electron-builder writes the marketing version into LSMinimumSystemVersion,
// while electron-updater compares update metadata against Darwin's os.release().
// The macOS native Widget this file used to gate is gone; only the app floor
// remains, and release checks read it from here so the two stay aligned.
const MAC_APP_MIN_VERSION = '12.0';
const MAC_APP_MIN_DARWIN_VERSION = '21.0.0';

module.exports = {
  MAC_APP_MIN_DARWIN_VERSION,
  MAC_APP_MIN_VERSION
};
