'use strict';
var self = outStep;

module.exports = self;

var fs = require('fs-extra');
var path = require('path');

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

  bag.who = util.format('%s|runCI|resources|state|%s', msName, self.name);
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
  return next();
}

function _getFilePaths(bag, next) {
  var who = bag.who + '|' + _getFilePaths.name;
  logger.debug(who, 'Inside');

  bag.resourceOutStatePath = path.join(bag.outRootDir, bag.dependency.name,
    bag.dependency.type);

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

  return next();
}

function _readFilePermissions(bag, next) {
  if (_.isEmpty(bag.allFilesLocation)) return next();

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
      }
      return next(err);
    }
  );
}

function _constructJson(bag, next) {
  if (_.isEmpty(bag.allFilesLocation)) return next();

  var who = bag.who + '|' + _constructJson.name;
  logger.debug(who, 'Inside');

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
          var contents = new Buffer(data).toString('base64');
          var obj = {
            permissions: bag.allFilesPermissions[fileLocation],
            path: path.relative(bag.resourceOutStatePath, fileLocation),
            contents: contents
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
      }

      return next(err);
    }
  );
}

function _postFiles(bag, next) {
  var who = bag.who + '|' + _postFiles.name;
  logger.debug(who, 'Inside');

  bag.builderApiAdapter.postFilesByResourceId(bag.dependency.resourceId,
    bag.stateJSON,
    function (err, res) {
      if (err) {
        if (res.id === ActErr.NoSystemIntegration) {
          var stateMsg = util.format('No system state is enabled. ' +
            'State cannot be saved.');
          bag.consoleAdapter.publishMsg(stateMsg);
          bag.consoleAdapter.closeCmd(false);
          return next();
        }
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
      return next();
    }
  );
}

function _readResourceVersion(bag, next) {
  var who = bag.who + '|' + _readResourceVersion.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.publishMsg('Reading version file');

  var resourceVersionPath = path.join(bag.rootDir, bag.dependency.name,
    bag.stepMessageFilename);

  fs.readJson(resourceVersionPath,
    function (err, resource) {
      if (err) {
        bag.consoleAdapter.publishMsg(util.format('Failed to read file %s.' +
          ' Hence skipping.', resourceVersionPath));
        bag.consoleAdapter.publishMsg(err);
        bag.consoleAdapter.closeCmd(false);
        return next();
      }

      bag.resource = resource;
      return next();
    }
  );
}

function _generateNewVersion(bag, next) {
  var who = bag.who + '|' + _generateNewVersion.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.publishMsg('Generating a new version');

  _.extend(bag.resource.version, {
    versionName: bag.sha,
    versionTrigger: false
  });
  _.extend(bag.resource.version.propertyBag, {
    shaData: bag.sha
  });

  return next();
}

function _writeResourceVersion(bag, next) {
  var who = bag.who + '|' + _writeResourceVersion.name;
  logger.debug(who, 'Inside');

  var resourceVersionPath = path.join(bag.rootDir, bag.dependency.name,
    bag.stepMessageFilename);

  fs.writeJson(resourceVersionPath, bag.resource,
    function (err) {
      if (err) {
        bag.consoleAdapter.publishMsg(util.format('Failed to write file %s.' +
          ' Hence skipping.', resourceVersionPath));
        bag.consoleAdapter.publishMsg(err);
        bag.consoleAdapter.closeCmd(false);
        return next();
      }

      bag.consoleAdapter.publishMsg('Successfully overrided version file.');
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
