const fs = require('fs')
const csv = require('csv-parser')
const glob = require('glob')
const { sourcePath, transPath } = require('./helpers')

const filteredRows = []

// Function to replace the pattern in a file
function replacePatternInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')

  const patternDoubleQuotes = /\$t\("(.*?)"\)/g
  content = content.replace(patternDoubleQuotes, (match, value) => {
    if (!filteredRows.find((item) => item.Key === value)) {
      console.log(`Find missing trans key in (/translations.csv) from ${filePath}`, value)
    }
  })

  const patternSingleQuotes = /\$t\('(.*?)'\)/g
  content = content.replace(patternSingleQuotes, (match, value) => {
    if (!filteredRows.find((item) => item.Key === value)) {
      console.log(`Find missing trans key in (/translations.csv) from ${filePath}`, value)
    }
  })
}

// Function to find the pattern in all matching files
function findPatternInFiles(sourcePath) {
  // Read the input CSV file
  fs.createReadStream(transPath)
    .pipe(csv()) // Skip header row
    .on('data', (row) => {
      filteredRows.push(row)
    })

  glob(`${sourcePath}/**/*.{vue,js}`, (err, files) => {
    if (err) {
      console.error('Error reading files:', err)
      return
    }
    files.forEach((file) => {
      replacePatternInFile(file)
    })
  })
}

module.exports = function () {
  this.checkTrans = function (options) {
    findPatternInFiles(sourcePath)
  }
}
