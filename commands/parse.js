const fs = require('fs')
const glob = require('glob')
const csv = require('csv-parser')
const { toCamelCase, sourcePath, transPath } = require('./helpers')

let headers = []
let parsedKeys = []
let originalKeys = []

// Read translations.csv and get the headers
fs.createReadStream(transPath)
  .pipe(csv())
  .on('headers', (row) => {
    headers = row
  })
  .on('data', (row) => {
    originalKeys.push(row.Key)
  })

// Function to replace the pattern in a file
function replacePatternInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  const languages = headers
    .slice(1, headers.length - 1)
    .map(() => `""`)
    .join(',')

  const parseValue = (value) => {
    let keys = []
    let parseValue = value.replace('//', '').trim()
    const indexOfSpliter = parseValue.indexOf('::')

    if (indexOfSpliter !== -1) {
      const parts = parseValue.split('::')
      keys.push(parts[0])
      parseValue = parts[1]
    }

    let identifier = parseValue

    const words = parseValue.split(' ')
    if (words.length > 2) {
      identifier = words.slice(0, 2).join(' ') + ' ' + words[words.length - 1]
    }

    keys.push(toCamelCase(identifier))

    return {
      key: keys.join('.'),
      value: parseValue
    }
  }

  const addToCsv = (key, value) => {
    if (!parsedKeys.includes(key) && !originalKeys.includes(key)) {
      // Construct the line to add to the CSV
      const line = `${key},"${value}",${languages}\n`
      parsedKeys.push(key)
      // Append the line to the CSV file
      fs.appendFile(transPath, line, (err) => {
        if (err) {
          console.error(`Error appending to CSV: ${err}`)
        } else {
          console.log(`Added to CSV: ${line.trim()}`)
        }
      })
    }
  }

  const patternDoubleQuotes = /"(.*?)"/g
  content = content.replace(patternDoubleQuotes, (match, result) => {
    if (result.startsWith('//')) {
      const { key, value } = parseValue(result)
      const replacement = `"${key}"`
      addToCsv(key, value)
      return replacement
    }
    return match
  })

  const patternSingleQuotes = /'(.*?)'/g
  content = content.replace(patternSingleQuotes, (match, result) => {
    if (result.startsWith('//')) {
      const { key, value } = parseValue(result)
      const replacement = `'${key}'`
      addToCsv(key, value)
      return replacement
    }
    return match
  })

  fs.writeFileSync(filePath, content, 'utf8')
}

// Function to replace the pattern in all matching files
function replacePatternInFiles(directoryPath) {
  glob(`${directoryPath}/**/*.{vue,js}`, (err, files) => {
    if (err) {
      console.error('Error reading files:', err)
      return
    }
    files.forEach((file) => {
      replacePatternInFile(file)
    })
  })
}

// Start the replacement process
module.exports = function () {
  this.parse = function (options) {
    replacePatternInFiles(sourcePath)
  }
}
