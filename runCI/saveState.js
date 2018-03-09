'use strict';
var self = saveState;

module.exports = self;

var fs = require('fs-extra');
var path = require('path');

function saveState(externalBag, callback) {
  var bag = {
    stateDir: externalBag.stateDir,
    resourceId: externalBag.inPayload.resourceId,
    builderApiAdapter: externalBag.builderApiAdapter,
    allFilesPermissions: {},
    stateJSON: [],
    consoleAdapter: externalBag.consoleAdapter
  };

  bag.who = util.format('%s|_common|%s', msName, self.name);
  logger.verbose(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getFilePaths.bind(null, bag),
      _readFilePermissions.bind(null, bag),
      _constructJson.bind(null, bag),
      _postFiles.bind(null, bag)
    ],
    function (err) {
      return callback(err, bag.sha);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.publishMsg('Validating dependencies to save current' +
    ' job files');

  var consoleErrors = [];

  if (!bag.resourceId)
    consoleErrors.push(util.format('%s is missing: resourceId', who));

  if (!bag.stateDir)
    consoleErrors.push(util.format('%s is missing: stateDir', who));

  if (consoleErrors.length > 0) {
    _.each(consoleErrors,
      function (e) {
        var msg = e;
        logger.error(bag.who, e);
        bag.consoleAdapter.publishMsg(msg);
      }
    );
    bag.consoleAdapter.closeCmd(false);
    return next(true);
  }

  bag.consoleAdapter.publishMsg('Successfully validated ' +
    'dependencies to save current job files');
  // bag.consoleAdapter.closeCmd(true);
  return next();
}

function _getFilePaths(bag, next) {
  var who = bag.who + '|' + _getFilePaths.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.publishMsg('Creating file list for current job');

  bag.allFilesLocation = getFileListRecursively(bag.stateDir);

  if (_.isEmpty(bag.allFilesLocation))
    bag.consoleAdapter.publishMsg('No files found to save');
  else
    bag.consoleAdapter.publishMsg('Successfully created file list ' +
      'for current job');

  // bag.consoleAdapter.closeCmd(true);
  return next();
}

function _readFilePermissions(bag, next) {
  if (_.isEmpty(bag.allFilesLocation)) return next();

  bag.consoleAdapter.publishMsg('Reading file permissions for current job');

  var who = bag.who + '|' + _readFilePermissions.name;
  logger.verbose(who, 'Inside');

  async.eachLimit(bag.allFilesLocation, 10,
    function (fileLocation, nextFileLocation) {
      fs.stat(fileLocation,
        function (err, stats) {
          if (err) {
            var msg = util.format('Failed to get permission for' +
              ' file:%s with err:%s', fileLocation, err);

            bag.consoleAdapter.publishMsg(msg);
            return nextFileLocation(true);
          }
          var permission = parseInt(stats.mode);
          bag.allFilesPermissions[fileLocation] = permission;
          return nextFileLocation();
        }
      );
    },
    function (err) {
      if (err)
        bag.consoleAdapter.closeCmd(false);
      else {
        bag.consoleAdapter.publishMsg('Successfully read file permissions ' +
          'for current job');
        // bag.consoleAdapter.closeCmd(true);
      }
      return next(err);
    }
  );
}

function _constructJson(bag, next) {
  if (_.isEmpty(bag.allFilesLocation)) return next();

  var who = bag.who + '|' + _constructJson.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.publishMsg('Constructing message for current job');

  async.eachLimit(bag.allFilesLocation, 10,
    function (fileLocation, nextFileLocation) {
      fs.readFile(fileLocation,
        function (err, data) {
          if (err) {
            var msg = util.format('Failed to create file: %s with err: %s',
              fileLocation, err);

            bag.consoleAdapter.publishMsg(msg);
            return nextFileLocation(true);
          }
          var obj = {
            permissions: bag.allFilesPermissions[fileLocation],
            path: fileLocation.substring(bag.stateDir.length,
              fileLocation.length),
            contents: data.toString()
          };

          bag.stateJSON.push(obj);
          return nextFileLocation();
        }
      );
    },
    function (err) {
      if (err)
        bag.consoleAdapter.closeCmd(false);
      else {
        bag.consoleAdapter.publishMsg('Successfully constructed message ' +
          'for current job');
        // bag.consoleAdapter.closeCmd(true);
      }

      return next(err);
    }
  );
}

function _postFiles(bag, next) {
  var who = bag.who + '|' + _postFiles.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.publishMsg('Posting message for current job');

  bag.builderApiAdapter.postFilesByResourceId(bag.resourceId, bag.stateJSON,
    function (err, res) {
      if (err) {
        if (res && res.message)
          err = res.message;
        var msg = util.format('%s, :postFilesByResourceId failed for ' +
          'resourceId: %s with error %s', who, bag.resourceId, err);

        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next(true);
      }
      bag.sha = res.sha;

      bag.consoleAdapter.publishMsg('Successfully posted message ' +
        'for current job');
      // bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function getFileListRecursively(dir, filelist) {
  var files = fs.readdirSync(dir);
  filelist = filelist || [];

  _.each(files,
    function (file) {
      if (fs.statSync(path.join(dir, file)).isDirectory())
        filelist = getFileListRecursively(path.join(dir, file), filelist);
      else
        filelist.push(path.join(dir, file));
    }
  );
  return filelist;
}
