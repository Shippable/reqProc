'use strict';
var self = getPreviousState;

module.exports = self;

var fs = require('fs-extra');

function getPreviousState(externalBag, callback) {
  var bag = {
    builderApiAdapter: externalBag.builderApiAdapter,
    resourceId: externalBag.inPayload.resourceId,
    previousStateDir: externalBag.buildPreviousStateDir,
    consoleAdapter: externalBag.consoleAdapter
  };

  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getFiles.bind(null, bag),
      _createFiles.bind(null, bag),
      _setPermissions.bind(null, bag)
    ],
    function (err) {
      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'builderApiAdapter',
    'resourceId',
    'previousStateDir',
    'consoleAdapter'
  ];

  var paramErrors = [];
  _.each(expectedParams,
    function (expectedParam) {
      if (_.isNull(bag[expectedParam]) || _.isUndefined(bag[expectedParam]))
        paramErrors.push(
          util.format('%s: missing param :%s', who, expectedParam)
        );
    }
  );

  var hasErrors = !_.isEmpty(paramErrors);
  if (hasErrors)
    logger.error(paramErrors.join('\n'));
  return next(hasErrors);
}

function _getFiles(bag, next) {
  var who = bag.who + '|' + _getFiles.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Getting files of previous job');

  var msg;
  var query = '';
  bag.builderApiAdapter.getFilesByResourceId(bag.resourceId, query,
    function (err, data) {
      if (err) {
        msg = util.format('%s, :getFilesByResourceId failed for ' +
          'resourceId: %s with error %s', who, bag.resourceId, err);

        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);

        return next(true);
      }
      bag.stateFileJSON = data;

      if (_.isEmpty(bag.stateFileJSON))
        msg = 'No files found for previous job';
      else
        msg = 'Successfully received files for previous job';

      bag.consoleAdapter.publishMsg(msg);
      bag.consoleAdapter.closeCmd(true);

      return next();
    }
  );
}

function _createFiles(bag, next) {
  if (_.isEmpty(bag.stateFileJSON)) return next();

  var who = bag.who + '|' + _createFiles.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Saving files of previous job');

  async.eachLimit(bag.stateFileJSON, 10,
    function (file, nextFile) {
      var path = util.format('%s%s', bag.previousStateDir, file.path);
      fs.outputFile(path, file.contents,
        function (err) {
          if (err) {
            var msg = util.format('%s, Failed to save file:%s with err:%s',
              who, file, err);

            bag.consoleAdapter.publishMsg(msg);

            return nextFile(true);
          }
          return nextFile();
        }
      );
    },
    function (err) {
      if (err)
        bag.consoleAdapter.closeCmd(false);
      else {
        bag.consoleAdapter.publishMsg('Successfully saved ' +
          'files for previous job');
        bag.consoleAdapter.closeCmd(true);
      }

      return next(err);
    }
  );
}

function _setPermissions(bag, next) {
  if (_.isEmpty(bag.stateFileJSON)) return next();

  var who = bag.who + '|' + _setPermissions.name;
  logger.verbose(who, 'Inside');

  bag.consoleAdapter.openCmd('Setting permissions on files of previous job');

  async.eachLimit(bag.stateFileJSON, 10,
    function (file, nextFile) {
      var path = util.format('%s%s', bag.previousStateDir, file.path);
      fs.chmod(path, file.permissions,
        function (err) {
          if (err) {
            var msg = util.format('%s, Failed to set permissions for ' +
              'file:%s with err:%s', who, path, err);

            bag.consoleAdapter.publishMsg(msg);

            return nextFile(true);
          }
          return nextFile();
        }
      );
    },
    function (err) {
      if (err)
        bag.consoleAdapter.closeCmd(false);
      else {
        bag.consoleAdapter.publishMsg('Successfully set permissions for ' +
          'files for previous job');
        bag.consoleAdapter.closeCmd(true);
      }

      return next(err);
    }
  );
}
