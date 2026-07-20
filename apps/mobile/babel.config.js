module.exports = function mobileBabelConfig(api) {
  api.cache(true);
  return {
    presets: ['module:@react-native/babel-preset'],
  };
};
