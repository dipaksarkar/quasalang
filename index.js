require('./commands/create-csv.js')();
require('./commands/generate.js')();
require('./commands/translate.js')();
require('./commands/lang-switcher.js')();
require('./commands/list-codes.js')();
require('./commands/parse.js')();

module.exports = {
  createCSV,
  generate,
  translate,
  langSwitcher,
  parse
};
