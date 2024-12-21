const fs = require('fs')
const csv = require('csv-parser')
const glob = require('glob')
const { sourcePath, transPath, createBackup } = require('./helpers')

const filteredRows = []

module.exports = function () {
  this.transClean = function (options) {
    createBackup()

    // Read the input CSV file
    fs.createReadStream(transPath)
      .pipe(csv())
      .on('data', (row) => {
        const key = row.Key

        // Escape the key for regex usage
        const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

        // Match keys wrapped in either single or double quotes
        const pattern = new RegExp(`[\"\']${escapedKey}[\"\']`, 'g')

        // Check if the key is present in any Vue or JS file in the directory (excluding i18n)
        const files = glob.sync(`${sourcePath}/**/*.{vue,js}`, {
          ignore: `${sourcePath}/i18n/**/*.{vue,js}`
        })

        // Debugging: Log matched files for the current key
        let foundInFiles = []

        const keyFound = files.some((filePath) => {
          const fileContent = fs.readFileSync(filePath, 'utf8')
          const isMatch = pattern.test(fileContent)
          if (isMatch) {
            foundInFiles.push(filePath)
          }
          return isMatch
        })

        if (keyFound) {
          filteredRows.push(row)
        } else {
          // Log missed keys and the pattern
          console.log(key, pattern)
        }
      })
      .on('end', () => {
        // Write the filtered rows to a new CSV file
        if (filteredRows.length > 0) {
          const header = Object.keys(filteredRows[0])
            .map((value) => `"${value.replace(/"/g, '""')}"`)
            .join(',')
          const rows = filteredRows.map((row) =>
            Object.values(row)
              .map((value) => `"${value.replace(/"/g, '""')}"`)
              .join(',')
          )
          const outputContent = [header, ...rows].join('\n')
          fs.writeFileSync(transPath, outputContent, 'utf8')
          console.log('New CSV file created successfully!')
        } else {
          console.log('No matching rows found. No new CSV file created.')
        }
      })
  }
}
