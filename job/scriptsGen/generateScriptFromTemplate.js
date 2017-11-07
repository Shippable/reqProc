'use strict';

var self = generateScriptFromTemplate;
module.exports = self;

var fs = require('fs-extra');

function generateScriptFromTemplate(externalBag, callback) {
  var bag = {
    object: externalBag.object,
    filePath: externalBag.filePath
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _createScript.bind(null, bag)
    ],
    function (err) {
      var result;
      if (err) {
        logger.error(bag.who, util.format('Failed to create script from ' +
        'template'));
      } else {
        logger.info(bag.who, 'Successfully created script from template');
        result = {
          script: bag.script
        };
      }
      return callback(err, result);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  return next();
}

function _createScript(bag, next) {
  var who = bag.who + '|' + _createScript.name;
  logger.verbose(who, 'Inside');

  try {
    bag.script = __applyTemplate(bag.filePath, bag.object);
  } catch (e) {
    return next(e);
  }

  return next();
}

function __applyTemplate(filePath, dataObj) {
  if (!fs.existsSync(filePath)) {
    logger.warn('No template file was found at', filePath);
    return '';
  }

  var fileContent = fs.readFileSync(filePath).toString();
  var template = _.template(fileContent);

  return template({obj: dataObj});
}
