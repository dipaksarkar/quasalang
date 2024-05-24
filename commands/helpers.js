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

module.exports = { toCamelCase }
