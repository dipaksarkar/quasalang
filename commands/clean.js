const fs = require('fs')
const csv = require('csv-parser')
const { transPath, createBackup } = require('./helpers')

module.exports = function () {
  this.clean = function (options) {
    createBackup()

    const rows = []
    const seenKeys = new Set()
    let duplicateCount = 0

    // Read the input CSV file
    fs.createReadStream(transPath)
      .pipe(csv())
      .on('data', (row) => {
        const key = row.Key

        if (!seenKeys.has(key)) {
          // First occurrence of this key, keep it
          seenKeys.add(key)
          rows.push(row)
        } else {
          // Duplicate found
          duplicateCount++
          console.log(`Duplicate key removed: ${key}`)
        }
      })
      .on('end', () => {
        if (duplicateCount === 0) {
          console.log('No duplicate keys found.')
          return
        }

        // Write the deduplicated rows back to the CSV file
        if (rows.length > 0) {
          const header = Object.keys(rows[0])
            .map((value) => `"${value.replace(/"/g, '""')}"`)
            .join(',')
          const rowData = rows.map((row) =>
            Object.values(row)
              .map((value) => `"${value.replace(/"/g, '""')}"`)
              .join(',')
          )
          const outputContent = [header, ...rowData].join('\n') + '\n'
          fs.writeFileSync(transPath, outputContent, 'utf8')
          console.log(
            `CSV file cleaned successfully! Removed ${duplicateCount} duplicate row(s).`
          )
        }
      })
  }
}
