const fs = require('fs')

const transPath = 'translations.csv'
const transBackupFile = 'translations.csv.bak'
const sourcePath = 'src'

// Function to convert a string to Camel Case
function toCamelCase(input) {
  return input
    .split(/[^a-zA-Z0-9]+/)
    .map((word, index) => {
      if (index === 0) {
        // Keep the first word as is
        return word.toLowerCase()
      } else {
        // Capitalize the first character of each word
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      }
    })
    .join('')
}

// Function to create a backup of the input file
function createBackup() {
  fs.copyFileSync(transPath, transBackupFile)
  console.log('Backup created:', transBackupFile)
}

module.exports = { toCamelCase, createBackup, transPath, transBackupFile, sourcePath }
