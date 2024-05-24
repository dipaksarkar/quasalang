var fs = require('fs')

const { prompt } = require('inquirer')
const { transPath } = require('./helpers')

module.exports = function () {
  this.createCSV = function (options) {
    let outputPath = transPath

    // check if output file exists
    if (fs.existsSync(outputPath)) {
      if (!options.force) {
        prompt([
          {
            type: 'confirm',
            name: 'confirmOverwrite',
            message: `File ${outputPath} exists. Overwrite it?`
          }
        ]).then((answers) => {
          if (answers.confirmOverwrite) {
            console.log('INFO: Skip this prompt in future with the --force (or -f) option.')
            copyFile()
          }
        })
      } else {
        copyFile()
      }
    } else {
      copyFile()
    }

    function copyFile() {
      fs.copyFile(`${__dirname}/../sample-csv/translations.csv`, `${outputPath}`, (err) => {
        if (err) throw err
        console.log(`/${transPath} was generated.`)
      })
    }
  }
}
