'use strict';
var self = parseSecureVariable;
module.exports = self;

function parseSecureVariable(secureValue) {
  if (!_.isString(secureValue)) return {};

  var parsedValues = {};

  var index = 0;
  var currentKey = '';
  var currentValue = '';
  var characterEscaped = false;
  var quoteCharacter = null; // null, ', or "

  while (index < secureValue.length) {
    if (!currentKey) {
      // Increment to the end of the key
      var endIndex = secureValue.indexOf('=', index);
      if (endIndex === -1)
        break;

      currentKey = secureValue.substring(index, endIndex);
      index = endIndex + 1;
      if (secureValue[index] === '\'' || secureValue[index] === '"') {
        quoteCharacter = secureValue[index];
        currentValue += quoteCharacter;
        index++;
      } else {
        quoteCharacter = null;
      }

      if (index > secureValue.length - 1)
        break;
    }

    if (characterEscaped) {
      currentValue += secureValue[index];
      characterEscaped = false;
    } else {
      var currentCharacter = secureValue[index];
      if (currentCharacter === '\\') {
        // The next character will is escaped.
        characterEscaped = true;
        currentValue += currentCharacter;
      } else if (quoteCharacter &&
        currentCharacter === quoteCharacter) {
        // Closes the quotes
        quoteCharacter = null;
        currentValue += currentCharacter;
      } else if (!quoteCharacter && currentCharacter === '=') {
        // Check for new quotes
        currentValue += currentCharacter;
        if (secureValue[index + 1] === '\'' ||
          secureValue[index + 1] === '"') {
          quoteCharacter = secureValue[index + 1];
          currentValue += quoteCharacter;
          index++;
        }
      } else if (!quoteCharacter && currentCharacter === ' ') {
        // Ends the value
        parsedValues[currentKey] = currentValue;
        currentKey = '';
        currentValue = '';
      } else {
        currentValue += currentCharacter;
      }
    }

    index++;
  }

  if (currentKey) // Unclosed quote or last key
    parsedValues[currentKey] = currentValue;

  _.each(parsedValues,
    function (value, key) {
      // Remove surrounding double quotes
      if (value[0] === '"' && value[value.length - 1] === '"')
        parsedValues[key] = value.substring(1, value.length - 1);
    }
  );

  return parsedValues;
}
