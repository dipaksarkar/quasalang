#! /usr/bin/env node

let pjson = require('./package.json')

const program = require('commander')
const {
  createCSV,
  generate,
  langSwitcher,
  listCodes,
  translate,
  parse,
  checkTrans,
  transClean,
  merge
} = require('./index.js')

const helpText = `

Getting Started
===============

Step 1. Create a sample CSV file (/translations.csv):
  $ quasalang create-csv

Step 2. Add your own languages & phrases to /translations.csv

Step 3. Generate your language files:
  $ quasalang generate
`

program
  .version(pjson.version)
  .description(
    'Generate Quasar i18n language files from a CSV file. Run it from the root of a Quasar project.'
  )
  .addHelpText('after', helpText)

program
  .command('generate')
  .alias('g')
  .option('-i, --input <mode>', 'Path to input CSV', 'translations.csv')
  .option('-o, --output <mode>', 'Path to i18n output folder', 'src/i18n')
  .option('-j, --json <mode>', 'Path to json output folder', 'public/langs')
  .option('-f, --force', 'Force write files (without prompt)', false)
  .option('-nw, --nowatermark', 'Disable the watermark ("This file was auto-generated..") ', false)
  .option('-c, --custom-key', 'Custom key', false)
  .option(
    '-ls, --lang-switcher',
    `Generate language switcher options array & output to console i.e. [{ label: 'English', value: 'en-US'}, ..]`,
    false
  )
  .option('-w, --watch', `Watch CSV file for changes & regenerate files`, false)
  .description('Generate your i18n folder & all language files based on a CSV file')
  .action((options) => {
    generate(options)
  })

program
  .command('translate')
  .alias('t')
  .option('-f, --force', 'Force write files (without prompt)', false)
  .description('Translate your CSV file using Google translate')
  .action((options) => {
    translate(options)
  })

program
  .command('parse')
  .alias('p')
  .option('-f, --force', 'Force write files (without prompt)', false)
  .option('-c, --custom-key', 'Custom key', false)
  .description(
    'Parse your source files from (/src/**/*.{js,vue}) and Add them to (/translations.csv) as Default language'
  )
  .action((options) => {
    parse(options)
  })

program
  .command('check-trans')
  .alias('ct')
  .description('Find missing trans key in (/translations.csv) from (/src/**/*.{js,vue})')
  .action((options) => {
    checkTrans(options)
  })

program
  .command('trans-clean')
  .alias('tc')
  .description('Remove unused trans key from (/translations.csv)')
  .action((options) => {
    transClean(options)
  })

program
  .command('create-csv')
  .alias('c')
  .option('-f, --force', 'Force overwrite translations file (without prompt)', false)
  .description('Create a sample CSV file (/translations.csv)')
  .action((options) => {
    createCSV(options)
  })

program
  .command('lang-switcher')
  .alias('ls')
  .option('-i, --input <mode>', 'Path to input CSV', 'translations.csv')
  .description(
    `Generate language switcher options array & output to console i.e. [{ label: 'English', value: 'en-US'}, ..]`
  )
  .action((options) => {
    langSwitcher(options)
  })

program
  .command('list-codes')
  .alias('lc')
  .option('-a, --add', 'Add locale codes to translations.csv', false)
  .description(`Search & list i18n locale codes`)
  .action((options) => {
    listCodes(options)
  })

program
  .command('merge')
  .alias('m')
  .option('-f, --file <path>', 'Path to CSV file to merge')
  .description('Merge another CSV file into translations.csv (preserves Key and English columns)')
  .action((options) => {
    merge(options)
  })

program.parse(process.argv)
