const { withStringsXml, AndroidConfig } = require('expo/config-plugins');

/**
 * Sets the launcher label (the name under the icon on the home screen)
 * independently from `expo.name`, which stays as the full product name.
 */
module.exports = function withAndroidAppLabel(config, { label }) {
  return withStringsXml(config, (cfg) => {
    cfg.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'app_name', translatable: 'false' }, _: label }],
      cfg.modResults,
    );
    return cfg;
  });
};
