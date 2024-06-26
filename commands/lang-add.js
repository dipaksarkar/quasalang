const fs = require('fs')
const csv = require('csv-parser')
const { transPath } = require('./helpers')

module.exports = function (langues) {
  // Read the input CSV file
  const rows = []
  let headers = []

  // check if output file exists
  if (fs.existsSync(transPath)) {
    fs.createReadStream(transPath)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList
        // Add new columns for each language if they don't already exist
        langues.forEach((langCode) => {
          if (!headers.includes(langCode)) {
            headers.push(langCode)
          }
        })
      })
      .on('data', (row) => {
        // Replace double quotes with double double quotes in row values
        for (const key in row) {
          if (row.hasOwnProperty(key)) {
            row[key] = row[key].replace(/"/g, '""')
          }
        }
        // Add an empty value for each new column to each row
        langues.forEach((langCode) => {
          if (!row.hasOwnProperty(langCode)) {
            row[langCode] = ''
          }
        })
        rows.push(row)
      })
      .on('end', () => {
        // Write the updated data to a new CSV file
        const csvData = [headers.map((header) => `"${header}"`).join(',')]
        rows.forEach((row) => {
          const values = headers.map((header) => `"${row[header] || ''}"`)
          csvData.push(values.join(','))
        })

        fs.writeFileSync(transPath, csvData.join('\n'))
        console.log(`CSV file successfully written with new lang codes: ${langues.join(', ')}.`)
      })
  } else {
    console.log(`/${transPath} file doesn't exist!`)
  }
}
