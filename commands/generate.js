const fs = require('fs');
const rimraf = require('rimraf');
const csv = require('csv-parser');

const { prompt } = require('inquirer');

require('./lang-switcher.js')();
require('../utils/getLanguagesAndCodesAsObjects.js')();

module.exports = function () {
    this.generate = function (options) {
        const watermark = 'This file was auto-generated by Quasalang';
        let watching = false;

        // sanitize options.input & options.output
        if (options.input.startsWith('/'))
            options.input = options.input.substring(1);
        if (options.output.startsWith('/'))
            options.output = options.output.substring(1);

        // create csv and write all files
        readCSVAndWrite();

        function readCSVAndWrite() {
            // somewhere to store message to list files written
            let filesWrittenMessage = [];

            // object to store translations
            let translations = {};

            // read the csv file
            fs.createReadStream(options.input)
                .pipe(csv())
                .on('data', (row) => {
                    const key = row['Key'];
                    for (const [header, value] of Object.entries(row)) {
                        if (header !== 'Key') {
                            const [languageLabel, languageCode] = header
                                .split(',')
                                .map((item) => item.trim());

                            // Split the key into parts to build the nested structure
                            const keyParts = key.split('.');
                            let currentObj =
                                translations[languageCode] ||
                                (translations[languageCode] = {
                                    lang: languageLabel,
                                    code: languageCode,
                                    label: `${languageLabel}, ${languageCode}`,
                                });

                            for (const part of keyParts.slice(0, -1)) {
                                currentObj =
                                    currentObj[part] || (currentObj[part] = {});
                            }
                            if (value.trim()) {
                                currentObj[keyParts.slice(-1)[0]] =
                                    value.trim();
                            }
                        }
                    }
                })
                .on('end', () => {
                    // initialize main index file
                    let mainIndexFile = ``;

                    // add watermark
                    if (!options.nowatermark) {
                        mainIndexFile += `// ${watermark}\n\n`;
                    }

                    // generate main index file import statements
                    for (const langCode in translations) {
                        const sanitizedLangCode = langCode.replace(/-/g, ''); // Remove hyphens
                        mainIndexFile += `import ${sanitizedLangCode} from './${langCode}'\n`;
                    }

                    // generate main index file export statement
                    mainIndexFile += `\n`;
                    mainIndexFile += `export default { \n`;
                    for (const langCode in translations) {
                        const sanitizedLangCode = langCode.replace(/-/g, ''); // Remove hyphens
                        mainIndexFile += `\t'${langCode}': ${sanitizedLangCode}, // ${translations[langCode].lang}\n`;
                    }
                    mainIndexFile += `}`;

                    // write the output folder if it doesn't exist
                    if (!fs.existsSync(options.output)) {
                        fs.mkdirSync(options.output, { recursive: true });
                    }

                    // write the main index file
                    fs.writeFile(
                        `${options.output}/index.js`,
                        mainIndexFile,
                        function (err) {
                            if (err) {
                                return console.log(err);
                            }
                            filesWrittenMessage.push({
                                File: 'Main index file',
                                Code: '',
                                Path: `${options.output}/index.js`,
                            });

                            // generate individual language files
                            for (const langCode in translations) {
                                const langObj = translations[langCode];
                                const langFilePath = `${options.output}/${langCode}.js`;
                                let langFileContent = `// ${langObj.label}\n`;

                                // add watermark
                                if (!options.nowatermark) {
                                    langFileContent += `// ${watermark}\n\n`;
                                }

                                langFileContent += `export default ${JSON.stringify(
                                    langObj,
                                    null,
                                    2
                                )};`;

                                fs.writeFile(
                                    langFilePath,
                                    langFileContent,
                                    function (err) {
                                        if (err) {
                                            return console.log(err);
                                        }
                                        filesWrittenMessage.push({
                                            File: langObj.lang,
                                            Code: langCode,
                                            Path: langFilePath,
                                        });

                                        if (
                                            filesWrittenMessage.length ===
                                            Object.keys(translations).length + 1
                                        ) {
                                            console.log(
                                                `\nWrote ${filesWrittenMessage.length} files:`
                                            );
                                            console.table(filesWrittenMessage);

                                            if (options.langSwitcher) {
                                                console.log('');
                                                langSwitcher({
                                                    input: options.input,
                                                });
                                            }

                                            setupWatcher();
                                        }
                                    }
                                );
                            }
                        }
                    );
                });
        }

        function setupWatcher() {
            if (options.watch) {
                setTimeout(() => {
                    timestampLog(`Watching ${options.input} for changes...`);

                    if (!watching) {
                        watching = true;
                        fs.watchFile(
                            options.input,
                            { interval: 1000 },
                            (curr, prev) => {
                                timestampLog(`File ${options.input} changed.`);
                                timestampLog(`Regenerating language files...`);
                                options.force = true;
                                readCSVAndWrite(options);
                            }
                        );
                    }
                }, 500);
            }
        }

        function timestampLog(message) {
            console.log(`[${new Date().toLocaleString()}] ${message}`);
        }
    };
};
