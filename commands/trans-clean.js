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
      .pipe(csv()) // Skip header row
      .on('data', (row) => {
        const key = row.Key
        const pattern = new RegExp(`"${key}"|'${key}'`, 'g')

        // Check if the key is present in any Vue or JS file in the directory (excluding i18n)
        const files = glob.sync(`${sourcePath}/**/*.{vue,js}`, {
          ignore: `${sourcePath}/i18n/**/*.{vue,js}`
        })

        const keyFound = files.some((filePath) => {
          const fileContent = fs.readFileSync(filePath, 'utf8')
          return pattern.test(fileContent)
        })

        if (keyFound) {
          filteredRows.push(row)
        } else {
          console.log(pattern, keyFound)
        }
      })
      .on('end', () => {
        // Check if there are any rows to write
        if (filteredRows.length > 0) {
          // Write the filtered rows to a new CSV file with double quotes around each value
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
