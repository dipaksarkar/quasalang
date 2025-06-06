const fs = require('fs')
const path = require('path')
const glob = require('glob')
const csv = require('csv-parser')
const { toCamelCase, sourcePath, transPath } = require('./helpers')

class VueTranslator {
  constructor() {
    this.translations = new Map()
    this.processedFiles = []
    this.existingTranslations = new Map()
  }

  // Check if text should be translated
  shouldTranslate(text) {
    const trimmed = text.trim()

    // Skip empty strings, numbers, or single characters
    if (!trimmed || trimmed.length < 2 || /^\d+$/.test(trimmed)) {
      return false
    }

    // Skip currency and common symbols
    if (/^[$€£¥₹¢₩₽₺₪₫₴₦₲₵₡₢₣₤₥₧₨₰₱₲₳₴₵₸₺₼₽₾₿]+$/.test(trimmed)) {
      return false
    }

    // Skip technical terms, URLs, or code-like content
    if (/^(href|src|class|id|data-|\/|#|@|::)/.test(trimmed)) {
      return false
    }

    // Skip shortcodes and HTML-like patterns
    if (/^<[^>]+>.*<\/[^>]+>$/.test(trimmed)) {
      return false
    }

    // Skip Vue directives and bindings
    if (/^(v-|:|@)/.test(trimmed)) {
      return false
    }

    // Only translate if it contains letters
    return /[a-zA-Z]/.test(trimmed)
  }

  // Clean and normalize text
  cleanText(text) {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace/newlines with single space
      .trim()
  }

  // Split text into sentences and limit to max 2 sentences
  splitAndLimitSentences(text) {
    const cleanedText = this.cleanText(text)

    // Split by sentence endings (., !, ?)
    const sentences = cleanedText.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0)

    if (sentences.length <= 2) {
      return [cleanedText]
    }

    // If more than 2 sentences, split into chunks of max 2 sentences
    const chunks = []
    for (let i = 0; i < sentences.length; i += 2) {
      const chunk = sentences.slice(i, i + 2).join(' ')
      chunks.push(chunk)
    }

    return chunks
  }

  // Wrap text with translation function using original text as key
  wrapWithTranslation(text) {
    if (!this.shouldTranslate(text)) {
      return text
    }

    const textChunks = this.splitAndLimitSentences(text)

    // If text was split into multiple chunks, process each separately
    if (textChunks.length > 1) {
      return textChunks
        .map((chunk) => {
          this.translations.set(chunk, chunk)
          // Use JSON.stringify to safely escape quotes and special characters
          return `{{ $t(${JSON.stringify(chunk)}) }}`
        })
        .join(' ')
    }

    // Single chunk processing
    const cleanText = textChunks[0]
    this.translations.set(cleanText, cleanText)
    // Use JSON.stringify to safely escape quotes and special characters
    return `{{ $t(${JSON.stringify(cleanText)}) }}`
  }

  // Helper method to determine if an attribute should be processed
  shouldProcessAttribute(fullAttributeMatch) {
    // Skip if this is already a bound attribute (starts with : or v-bind:)
    if (fullAttributeMatch.match(/^(:|v-bind:)/i)) {
      return false
    }
    return true
  }

  // Process Vue content
  processVueContent(content) {
    let processed = content

    // First, protect script and style content by replacing with placeholders
    const protectedContent = new Map()
    let placeholderCounter = 0

    // Protect <script> blocks
    processed = processed.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
      const placeholder = `__SCRIPT_PLACEHOLDER_${placeholderCounter++}__`
      protectedContent.set(placeholder, match)
      return placeholder
    })

    // Protect <style> blocks
    processed = processed.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, (match) => {
      const placeholder = `__STYLE_PLACEHOLDER_${placeholderCounter++}__`
      protectedContent.set(placeholder, match)
      return placeholder
    })

    // Protect v-html attributes with $t calls
    processed = processed.replace(
      /v-html\s*=\s*["']([\s\S]*?\$t\s*\([\s\S]*?\)[\s\S]*?)["']/gi,
      (match, content) => {
        const placeholder = `__V_HTML_PLACEHOLDER_${placeholderCounter++}__`
        protectedContent.set(placeholder, match)
        return placeholder
      }
    )

    // More comprehensive protection for existing translations
    // First, protect $t calls with their content to avoid nested translations
    const translationPattern = /(\$t\(['"].*?['"](?:,\s*\{.*?\})?\))/gi
    processed = processed.replace(translationPattern, (match) => {
      const placeholder = `__TRANSLATION_PLACEHOLDER_${placeholderCounter++}__`
      protectedContent.set(placeholder, match)

      // Extract key from $t call to track it
      const keyMatch = match.match(/\$t\(['"](.+?)['"](?:,|\))/)
      if (keyMatch && keyMatch[1]) {
        // Add to translations map to avoid retranslating
        this.translations.set(keyMatch[1], keyMatch[1])
      }

      return placeholder
    })

    // Also protect interpolated translations {{ $t(...) }}
    processed = processed.replace(/\{\{\s*(\$t\(['"].*?['"](?:,\s*\{.*?\})?\))\s*\}\}/gi, (match, tCall) => {
      const placeholder = `__INTERPOLATION_PLACEHOLDER_${placeholderCounter++}__`
      protectedContent.set(placeholder, match)

      // Extract key from $t call to track it
      const keyMatch = tCall.match(/\$t\(['"](.+?)['"](?:,|\))/)
      if (keyMatch && keyMatch[1]) {
        // Add to translations map to avoid retranslating
        this.translations.set(keyMatch[1], keyMatch[1])
      }

      return placeholder
    })

    // Patterns to match text content in Vue template
    const textPatterns = [
      // Button content
      {
        pattern: /(<q-btn[^>]*>)\s*([^<{]+?)\s*(<\/q-btn>)/gi,
        replacement: (match, openTag, text, closeTag) => {
          return openTag + this.wrapWithTranslation(text) + closeTag
        }
      },
      // Label content
      {
        pattern: /(<label[^>]*>)\s*([^<{]+?)\s*(<\/label>)/gi,
        replacement: (match, openTag, text, closeTag) => {
          return openTag + this.wrapWithTranslation(text) + closeTag
        }
      },
      // Header tags (h1-h6)
      {
        pattern: /(<h[1-6][^>]*>)\s*([^<{]+?)\s*(<\/h[1-6]>)/gi,
        replacement: (match, openTag, text, closeTag) => {
          return openTag + this.wrapWithTranslation(text) + closeTag
        }
      },
      // Paragraph content
      {
        pattern: /(<p[^>]*>)\s*([^<{]+?)\s*(<\/p>)/gi,
        replacement: (match, openTag, text, closeTag) => {
          return openTag + this.wrapWithTranslation(text) + closeTag
        }
      },
      // Span content
      {
        pattern: /(<span[^>]*>)\s*([^<{]+?)\s*(<\/span>)/gi,
        replacement: (match, openTag, text, closeTag) => {
          return openTag + this.wrapWithTranslation(text) + closeTag
        }
      },
      // Div content with only text
      {
        pattern: /(<div[^>]*>)\s*([^<{]+?)\s*(<\/div>)/gi,
        replacement: (match, openTag, text, closeTag) => {
          return openTag + this.wrapWithTranslation(text) + closeTag
        }
      },
      // List items
      {
        pattern: /(<li[^>]*>)\s*([^<{]+?)\s*(<\/li>)/gi,
        replacement: (match, openTag, text, closeTag) => {
          return openTag + this.wrapWithTranslation(text) + closeTag
        }
      },
      // Table cells
      {
        pattern: /(<td[^>]*>)\s*([^<{]+?)\s*(<\/td>)/gi,
        replacement: (match, openTag, text, closeTag) => {
          return openTag + this.wrapWithTranslation(text) + closeTag
        }
      },
      // Table headers
      {
        pattern: /(<th[^>]*>)\s*([^<{]+?)\s*(<\/th>)/gi,
        replacement: (match, openTag, text, closeTag) => {
          return openTag + this.wrapWithTranslation(text) + closeTag
        }
      },
      // Quasar specific components
      {
        pattern: /(<q-item-label[^>]*>)\s*([^<{]+?)\s*(<\/q-item-label>)/gi,
        replacement: (match, openTag, text, closeTag) => {
          return openTag + this.wrapWithTranslation(text) + closeTag
        }
      },
      {
        pattern: /(<q-item-section[^>]*>)\s*([^<{]+?)\s*(<\/q-item-section>)/gi,
        replacement: (match, openTag, text, closeTag) => {
          return openTag + this.wrapWithTranslation(text) + closeTag
        }
      },
      {
        pattern: /(<q-card-section[^>]*>)\s*([^<{]+?)\s*(<\/q-card-section>)/gi,
        replacement: (match, openTag, text, closeTag) => {
          return openTag + this.wrapWithTranslation(text) + closeTag
        }
      },
      // Placeholder attributes - only match regular placeholder="text" not :placeholder or v-bind:placeholder
      {
        pattern: / placeholder=(["'])(.*?)\1(?=[^=]|$)/gi, // Match full placeholder attribute
        replacement: (match, prefix, text, suffix) => {
          if (!this.shouldProcessAttribute(prefix) || !this.shouldTranslate(text)) {
            return match
          }
          this.translations.set(text, text)
          // Replace problematic characters with valid alternatives instead of escaping
          const safeKey = text
            .replace(/'/g, '`') // Replace single quotes with backticks
            .replace(/\\/g, '') // Remove backslashes
          return ` :placeholder="$t('${safeKey}')"`
        }
      },
      // Label attributes - only match regular label="text" not :label or v-bind:label
      {
        pattern: / label=(["'])(.*?)\1(?=[^=]|$)/gi, // Match full label attribute
        replacement: (match, prefix, text, suffix) => {
          if (!this.shouldProcessAttribute(prefix) || !this.shouldTranslate(text)) {
            return match
          }
          this.translations.set(text, text)
          // Replace problematic characters with valid alternatives instead of escaping
          const safeKey = text
            .replace(/'/g, '`') // Replace single quotes with backticks
            .replace(/\\/g, '') // Remove backslashes
          return ` :label="$t('${safeKey}')"`
        }
      },
      // Title attributes - only match regular title="text" not :title or v-bind:title
      {
        pattern: / title=(["'])(.*?)\1(?=[^=]|$)/gi, // Match full title attribute
        replacement: (match, prefix, text, suffix) => {
          if (!this.shouldProcessAttribute(prefix) || !this.shouldTranslate(text)) {
            return match
          }
          this.translations.set(text, text)
          // Replace problematic characters with valid alternatives instead of escaping
          const safeKey = text
            .replace(/'/g, '`') // Replace single quotes with backticks
            .replace(/\\/g, '') // Remove backslashes
          return ` :title="$t('${safeKey}')"`
        }
      },
      // Message attributes - only match regular message="text" not :message or v-bind:message
      {
        pattern: / message=(["'])(.*?)\1(?=[^=]|$)/gi, // Match full message attribute
        replacement: (match, prefix, text, suffix) => {
          if (!this.shouldProcessAttribute(prefix) || !this.shouldTranslate(text)) {
            return match
          }
          this.translations.set(text, text)
          // Replace problematic characters with valid alternatives instead of escaping
          const safeKey = text
            .replace(/'/g, '`') // Replace single quotes with backticks
            .replace(/\\/g, '') // Remove backslashes
          return ` :message="$t('${safeKey}')"`
        }
      },
      // Hint attributes - special handling for complex content
      {
        pattern: / hint=(["'])(.*?)\1(?=[^=]|$)/gi, // Match full hint attribute
        replacement: (match, quote, text) => {
          if (!this.shouldTranslate(text)) {
            return match
          }
          this.translations.set(text, text)

          // Replace problematic characters with valid alternatives instead of escaping
          const safeKey = text
            .replace(/'/g, '`') // Replace single quotes with backticks
            .replace(/\\/g, '') // Remove backslashes

          // Use the sanitized key directly
          return ` :hint="$t('${safeKey}')"`
        }
      },
      // Alt text for images - only match regular alt="text" not :alt or v-bind:alt
      {
        pattern: / alt=(["'])(.*?)\1(?=[^=]|$)/gi, // Match full alt attribute
        replacement: (match, prefix, text, suffix) => {
          if (!this.shouldProcessAttribute(prefix) || !this.shouldTranslate(text)) {
            return match
          }
          this.translations.set(text, text)
          // Replace problematic characters with valid alternatives instead of escaping
          const safeKey = text
            .replace(/'/g, '`') // Replace single quotes with backticks
            .replace(/\\/g, '') // Remove backslashes
          return ` :alt="$t('${safeKey}')"`
        }
      }
    ]

    // Apply patterns
    textPatterns.forEach(({ pattern, replacement }) => {
      processed = processed.replace(pattern, replacement)
    })

    // Restore protected content
    // Sort placeholders by length (descending) to avoid partial replacements
    const sortedPlaceholders = Array.from(protectedContent.keys()).sort((a, b) => b.length - a.length)

    for (const placeholder of sortedPlaceholders) {
      const originalContent = protectedContent.get(placeholder)
      // Replace all occurrences of the placeholder
      processed = processed.split(placeholder).join(originalContent)
    }

    return processed
  }

  // Check if path is a directory
  isDirectory(filePath) {
    try {
      return fs.statSync(filePath).isDirectory()
    } catch (error) {
      return false
    }
  }

  // Check if file is a Vue file
  isVueFile(filePath) {
    return path.extname(filePath) === '.vue'
  }

  // Get all Vue files in directory recursively
  getVueFiles(dirPath) {
    const vueFiles = []

    const scanDirectory = (currentPath) => {
      try {
        const items = fs.readdirSync(currentPath)

        items.forEach((item) => {
          const itemPath = path.join(currentPath, item)
          const stat = fs.statSync(itemPath)

          if (stat.isDirectory()) {
            scanDirectory(itemPath)
          } else if (stat.isFile() && this.isVueFile(itemPath)) {
            vueFiles.push(itemPath)
          }
        })
      } catch (error) {
        console.warn(`⚠️  Cannot read directory: ${currentPath}`)
      }
    }

    scanDirectory(dirPath)
    return vueFiles
  }

  // Process single file in place
  processFileInPlace(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')

      // Check if file already has many translations
      const translationCount = (content.match(/\$t\(['"]/g) || []).length
      if (translationCount > 5) {
        console.log(`⏭️  Skipping already well-translated file: ${filePath}`)
        return false
      }

      const processed = this.processVueContent(content)

      // Only write if content changed
      if (processed !== content) {
        fs.writeFileSync(filePath, processed)
        this.processedFiles.push(filePath)
        console.log(`✅ Updated file: ${filePath}`)
        return true
      } else {
        console.log(`⏭️  No changes needed: ${filePath}`)
        return false
      }
    } catch (error) {
      console.error(`❌ Error processing file ${filePath}:`, error.message)
      return false
    }
  }

  // Process multiple files
  async processPath(inputPath, options = {}) {
    let filesToProcess = []

    if (this.isDirectory(inputPath)) {
      console.log(`📁 Processing directory: ${inputPath}`)
      filesToProcess = this.getVueFiles(inputPath)
      console.log(`🔍 Found ${filesToProcess.length} Vue files`)
    } else if (fs.existsSync(inputPath)) {
      console.log(`📄 Processing single file: ${inputPath}`)
      filesToProcess = [inputPath]
    } else {
      throw new Error(`Path does not exist: ${inputPath}`)
    }

    if (filesToProcess.length === 0) {
      console.log('ℹ️  No Vue files found to process')
      return
    }

    // Process each file
    let successCount = 0
    filesToProcess.forEach((filePath) => {
      if (this.processFileInPlace(filePath)) {
        successCount++
      }
    })

    // Print summary
    console.log('\n📋 Processing Summary:')
    console.log(`   Files processed: ${successCount}/${filesToProcess.length}`)
    console.log(`   Translations found: ${this.translations.size}`)

    if (this.processedFiles.length > 0) {
      console.log('\n📝 Modified files:')
      this.processedFiles.forEach((file) => {
        console.log(`   - ${file}`)
      })
    }
  }
}

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
function replacePatternInFile(filePath, options) {
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
      const line = `"${key}","${value}",${languages}\n`
      parsedKeys.push(key)
      // Append the line to the CSV file
      fs.appendFile(transPath, line, (err) => {
        if (err) {
          console.error(`Error appending to CSV: ${err}`)
        } else {
          console.log(`Added to CSV from ${filePath}: ${line.trim()}`)
        }
      })
    }
  }

  // Capture Double quoted strings with parameters
  // Handles: $t("text", {...}) with any whitespace
  const doubleQuoteWithParams = new RegExp(`\\$t\\(\\s*"(.*?)"\\s*,\\s*{[^}]*}\\s*\\)`, 'g')
  content = content.replace(doubleQuoteWithParams, (match, result) => {
    if (options.customKey) {
      const { key, value } = parseValue(result)
      // Keep the original parameters part
      const paramsStart = match.indexOf(',')
      const paramsSection = match.substring(paramsStart)
      const replacement = `$t("${key}"${paramsSection}`
      addToCsv(key, value)
      return replacement
    } else if (typeof result === 'string') {
      addToCsv(result, result)
    }
    return match
  })

  // Capture Single quoted strings with parameters
  // Handles: $t('text', {...}) with any whitespace
  const singleQuoteWithParams = new RegExp(`\\$t\\(\\s*'(.*?)'\\s*,\\s*{[^}]*}\\s*\\)`, 'g')
  content = content.replace(singleQuoteWithParams, (match, result) => {
    if (options.customKey) {
      const { key, value } = parseValue(result)
      // Keep the original parameters part
      const paramsStart = match.indexOf(',')
      const paramsSection = match.substring(paramsStart)
      const replacement = `$t('${key}'${paramsSection}`
      addToCsv(key, value)
      return replacement
    } else if (typeof result === 'string') {
      addToCsv(result, result)
    }
    return match
  })

  // Handle standard translation patterns (simple double quotes)
  const doubleQuote = new RegExp(`\\$t\\(\\s*"(.*?)"\\s*\\)`, 'g')
  content = content.replace(doubleQuote, (match, result) => {
    if (options.customKey) {
      const { key, value } = parseValue(result)
      const replacement = `$t("${key}")`
      addToCsv(key, value)
      return replacement
    } else if (typeof result === 'string') {
      addToCsv(result, result)
    }
    return match
  })

  // Handle standard translation patterns (simple single quotes)
  const singleQuote = new RegExp(`\\$t\\(\\s*'(.*?)'\\s*\\)`, 'g')
  content = content.replace(singleQuote, (match, result) => {
    if (options.customKey) {
      const { key, value } = parseValue(result)
      const replacement = `$t('${key}')`
      addToCsv(key, value)
      return replacement
    } else if (typeof result === 'string') {
      addToCsv(result, result)
    }
    return match
  })

  fs.writeFileSync(filePath, content, 'utf8')
}

// Function to replace the pattern in all matching files
function replacePatternInFiles(directoryPath, options) {
  glob(`${directoryPath}/**/*.{vue,js}`, (err, files) => {
    if (err) {
      console.error('Error reading files:', err)
      return
    }
    files.forEach((file) => {
      replacePatternInFile(file, options)
    })
  })
}

// Function to process files using VueTranslator before parsing
async function makeFilesTranslatable(directoryPath, options) {
  console.log('🔍 Starting to make files translatable...')

  const translator = new VueTranslator()

  try {
    // Use transPath for CSV operations
    await translator.processPath(directoryPath, options)
    console.log('✅ Translation preparation completed successfully!')
  } catch (error) {
    console.error(`❌ Error during translation preparation: ${error.message}`)
  }
}

// Start the replacement process
module.exports = function () {
  this.parse = async function (options) {
    try {
      // First make files translatable, then run the regular parse
      await makeFilesTranslatable(sourcePath, options)

      // Then proceed with the original parsing logic
      replacePatternInFiles(sourcePath, options)
    } catch (error) {
      console.error(`❌ Error during parse operation: ${error.message}`)
    }
  }
}
