const fs = require('fs')
const csv = require('csv-parser')
const glob = require('glob')
const { sourcePath, transPath } = require('./helpers')

let translationKeys = new Set()

// Function to check for missing translation keys in a file
function checkMissingKeysInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')

  // Combined pattern for both $t() and t() functions with both quote types
  const patterns = [
    /\$t\(["'](.*?)["']\)/g, // $t("key") or $t('key')
    /\bt\(["'](.*?)["']\)/g // t("key") or t('key')
  ]

  patterns.forEach((pattern) => {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const key = match[1]
      if (!translationKeys.has(key)) {
        console.log(`Missing translation key in CSV: "${key}" (found in ${filePath})`)
      }
    }
  })
}

// Function to load CSV and check all files
function checkMissingTranslations() {
  // First, load all translation keys from CSV
  fs.createReadStream(transPath)
    .pipe(csv())
    .on('data', (row) => {
      if (row.Key) {
        translationKeys.add(row.Key)
      }
    })
    .on('end', () => {
      console.log(`Loaded ${translationKeys.size} translation keys from CSV`)

      // Then check all files for missing keys
      glob(
        `${sourcePath}/**/*.{vue,js}`,
        {
          ignore: `${sourcePath}/i18n/**/*.{vue,js}`
        },
        (err, files) => {
          if (err) {
            console.error('Error reading files:', err)
            return
          }

          console.log(`Checking ${files.length} files for missing translation keys...`)
          files.forEach(checkMissingKeysInFile)
          console.log('Translation key check completed!')
        }
      )
    })
    .on('error', (err) => {
      console.error('Error reading translation CSV:', err)
    })
}

module.exports = function () {
  this.checkTrans = function (options) {
    translationKeys.clear() // Reset for each run
    checkMissingTranslations()
  }
}
