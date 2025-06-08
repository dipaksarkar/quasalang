const fs = require('fs')
const csv = require('csv-parser')
const { transPath, createBackup } = require('./helpers')

module.exports = function () {
  this.merge = async function (options) {
    if (!options.file) {
      console.error('❌ Error: Please specify a file to merge with --file option')
      return
    }

    const mergeFilePath = options.file

    // Check if merge file exists
    if (!fs.existsSync(mergeFilePath)) {
      console.error(`❌ Error: Merge file does not exist: ${mergeFilePath}`)
      return
    }

    // Check if translations.csv exists
    if (!fs.existsSync(transPath)) {
      console.error(`❌ Error: translations.csv does not exist: ${transPath}`)
      return
    }

    try {
      createBackup()
      console.log(`🔄 Merging ${mergeFilePath} into ${transPath}...`)

      // Load existing translations
      const existingTranslations = new Map()
      let headers = []

      await new Promise((resolve, reject) => {
        fs.createReadStream(transPath)
          .pipe(csv())
          .on('headers', (headerRow) => {
            headers = headerRow
          })
          .on('data', (row) => {
            existingTranslations.set(row.Key, row)
          })
          .on('end', resolve)
          .on('error', reject)
      })

      console.log(`📄 Loaded ${existingTranslations.size} existing translations`)

      // Load merge file translations
      const mergeTranslations = new Map()
      let mergeHeaders = []

      await new Promise((resolve, reject) => {
        fs.createReadStream(mergeFilePath)
          .pipe(csv())
          .on('headers', (headerRow) => {
            mergeHeaders = headerRow
          })
          .on('data', (row) => {
            mergeTranslations.set(row.Key, row)
          })
          .on('end', resolve)
          .on('error', reject)
      })

      console.log(`📄 Loaded ${mergeTranslations.size} merge translations`)

      // Merge headers first (add missing columns from merge file)
      const newHeaders = [...headers]
      mergeHeaders.forEach((mergeHeader, index) => {
        // Skip Key and English columns, add other missing columns
        if (index > 1 && !headers.includes(mergeHeader)) {
          newHeaders.push(mergeHeader)
          console.log(`➕ Adding new column: ${mergeHeader}`)
        }
      })

      // Merge translations (keep Key and English from existing, override others from merge file)
      let mergedCount = 0
      let newCount = 0
      let ignoredCount = 0
      let addedColumns = newHeaders.length - headers.length

      for (const [key, mergeRow] of mergeTranslations) {
        if (existingTranslations.has(key)) {
          // Key exists - merge translations but keep Key and English from existing
          const existingRow = existingTranslations.get(key)
          const mergedRow = { ...existingRow }

          // Add empty values for new columns first
          newHeaders.forEach((header) => {
            if (!mergedRow.hasOwnProperty(header)) {
              mergedRow[header] = ''
            }
          })

          // Override/add all columns except Key and first language (English)
          Object.keys(mergeRow).forEach((column, index) => {
            // Skip Key (index 0) and English (index 1)
            if (index > 1 && mergeHeaders[index]) {
              const headerName = mergeHeaders[index]
              mergedRow[headerName] = mergeRow[column]
            }
          })

          existingTranslations.set(key, mergedRow)
          mergedCount++
        } else {
          // Key doesn't exist in target file - ignore it
          console.log(`🚫 Ignoring unknown key: ${key}`)
          ignoredCount++
        }
      }

      // Add empty values for new columns to existing rows that weren't in merge file
      if (addedColumns > 0) {
        for (const [key, row] of existingTranslations) {
          newHeaders.forEach((header) => {
            if (!row.hasOwnProperty(header)) {
              row[header] = ''
            }
          })
        }
      }

      // Write merged translations back to CSV
      const allRows = Array.from(existingTranslations.values())

      if (allRows.length > 0) {
        const headerLine = newHeaders.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')

        const rows = allRows.map((row) =>
          newHeaders.map((header) => `"${(row[header] || '').replace(/"/g, '""')}"`).join(',')
        )

        const outputContent = [headerLine, ...rows].join('\n') + '\n'
        fs.writeFileSync(transPath, outputContent, 'utf8')

        console.log('✅ Merge completed successfully!')
        console.log(`   Updated translations: ${mergedCount}`)
        console.log(`   Ignored unknown keys: ${ignoredCount}`)
        console.log(`   Added columns: ${addedColumns}`)
        console.log(`   Total translations: ${allRows.length}`)
      } else {
        console.log('⚠️  No translations to write')
      }
    } catch (error) {
      console.error(`❌ Error during merge: ${error.message}`)
    }
  }
}
