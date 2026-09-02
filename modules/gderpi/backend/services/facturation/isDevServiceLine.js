const isPrestationLine = require('../workflow/isPrestationLine');

function isDevServiceLine(line) {
  return isPrestationLine(line);
}

module.exports = isDevServiceLine;
