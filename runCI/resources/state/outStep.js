'use strict';
var self = outStep;

module.exports = self;

var fs = require('fs-extra');

function outStep(externalBag, callback) {
  var bag = {
    rawMessage: externalBag.rawMessage,
    outRootDir: externalBag.rootDir,
    builderApiAdapter: externalBag.builderApiAdapter,
    dependency: externalBag.dependency,
    allFilesPermissions: {},
    stateJSON: [],
    consoleAdapter: externalBag.consoleAdapter,
    rootDir: externalBag.rootDir,
    stepMessageFilename: externalBag.stepMessageFilename
  };

  bag.who = util.format('%s|runCI|resources|params|%s', msName, self.name);
  logger.verbose(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _getFilePaths.bind(null, bag),
      _readFilePermissions.bind(null, bag),
      _constructJson.bind(null, bag),
      _postFiles.bind(null, bag),
      _readResourceVersion.bind(null, bag),
      _generateNewVersion.bind(null, bag),
      _writeResourceVersion.bind(null, bag)
    ],
    function (err) {
      return callback(err, bag.sha);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Validating dependencies to save current' +
    ' central state files');

  var consoleErrors = [];

  if (!bag.dependency.resourceId)
    consoleErrors.push(util.format('%s is missing: resourceId', who));

  if (!bag.outRootDir)
    consoleErrors.push(util.format('%s is missing: outRootDir', who));

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
    'dependencies to save current resource state files');
  bag.consoleAdapter.closeCmd(true);
  return next();
}

function _getFilePaths(bag, next) {
  var who = bag.who + '|' + _getFilePaths.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Creating file list for current resource');

  bag.resourceOutStatePath = util.format('%s/%s/%s', bag.outRootDir,
    bag.dependency.name, bag.dependency.type);

  try {
    bag.allFilesLocation = getFileListRecursively(bag.resourceOutStatePath);
  } catch (err) {
    var errMsg = err;
    logger.error(bag.who, err);
    bag.consoleAdapter.publishMsg(errMsg.message);
    bag.consoleAdapter.closeCmd(false);
    return next(true);
  }

  if (_.isEmpty(bag.allFilesLocation))
    bag.consoleAdapter.publishMsg('No files found to save');
  else
    bag.consoleAdapter.publishMsg('Successfully created file list ' +
      'for current resource');

  bag.consoleAdapter.closeCmd(true);
  return next();
}

function _readFilePermissions(bag, next) {
  if (_.isEmpty(bag.allFilesLocation)) return next();

  bag.consoleAdapter.openCmd('Reading file permissions for current resource');

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
          'for current resource');
        bag.consoleAdapter.closeCmd(true);
      }
      return next(err);
    }
  );
}

function _constructJson(bag, next) {
  if (_.isEmpty(bag.allFilesLocation)) return next();

  var who = bag.who + '|' + _constructJson.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Constructing message for current resource');

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
            path: fileLocation.substring(bag.resourceOutStatePath.length,
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
          'for current resource');
        bag.consoleAdapter.closeCmd(true);
      }

      return next(err);
    }
  );
}

function _postFiles(bag, next) {
  var who = bag.who + '|' + _postFiles.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Posting message for current resource');

  bag.builderApiAdapter.postFilesByResourceId(bag.dependency.resourceId,
    bag.stateJSON,
    function (err, res) {
      if (err) {
        if (res && res.message)
          err = res.message;
        var msg = util.format('%s, :postFilesByResourceId failed for ' +
          'resourceId: %s with error %s', who, bag.dependency.resourceId, err);

        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next(true);
      }
      bag.sha = res.sha;

      bag.consoleAdapter.publishMsg('Successfully posted message ' +
        'for current resource');
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function _readResourceVersion(bag, next) {
  var who = bag.who + '|' + _readResourceVersion.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Reading version file');

  var path = util.format('%s/%s/%s', bag.rootDir, bag.dependency.name,
    bag.stepMessageFilename);

  fs.readJson(path,
    function (err, resource) {
      if (err) {
        bag.consoleAdapter.publishMsg(util.format('Failed to read file %s.' +
          ' Hence skipping.', path));
        bag.consoleAdapter.publishMsg(err);
        bag.consoleAdapter.closeCmd(false);
        return next();
      }

      bag.resource = resource;
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function _generateNewVersion(bag, next) {
  var who = bag.who + '|' + _generateNewVersion.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Generating a new version');

  _.extend(bag.resource.version, {
    versionName: bag.sha,
    versionTrigger: false
  });
  _.extend(bag.resource.version.propertyBag, {
    shaData: bag.sha
  });

  bag.consoleAdapter.closeCmd(true);
  return next();
}

function _writeResourceVersion(bag, next) {
  var who = bag.who + '|' + _writeResourceVersion.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Overriding version file');

  var path = util.format('%s/%s/%s', bag.rootDir, bag.dependency.name,
    bag.stepMessageFilename);

  fs.writeJson(path, bag.resource,
    function (err) {
      if (err) {
        bag.consoleAdapter.publishMsg(util.format('Failed to write file %s.' +
          ' Hence skipping.', path));
        bag.consoleAdapter.publishMsg(err);
        bag.consoleAdapter.closeCmd(false);
        return next();
      }

      bag.consoleAdapter.publishMsg('Successfully overrided version file.');
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function getFileListRecursively(dir, filelist) {
  var files = fs.readdirSync(dir);
  filelist = filelist || [];

  _.each(files,
    function (file) {
      if (fs.statSync(dir + '/' + file).isDirectory())
        filelist = getFileListRecursively(dir + '/' + file, filelist);
      else
        filelist.push(dir + '/' + file);
    }
  );
  return filelist;
}
