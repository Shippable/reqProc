'use strict';
var self = inStep;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

function inStep(params, callback) {
  var bag = {
    resBody: {},
    dependency: params.dependency,
    buildInDir: params.rootDir,
    builderApiAdapter: params.builderApiAdapter,
    consoleAdapter: params.consoleAdapter,
    tempDir: '/tmp/',
    outputFileJSON: []
  };

  bag.who = msName + '|_common|resources|params|' + self.name;
  logger.verbose(bag.who, 'Starting');

  bag.paramsPath =
    path.join(bag.buildInDir, bag.dependency.name, 'params');

  async.series([
      _checkInputParams.bind(null, bag),
      _getFiles.bind(null, bag),
      _createFiles.bind(null, bag),
      _setPermissions.bind(null, bag)
    ],
    function (err) {
      logger.verbose(bag.who, 'Completed');
      return callback(err, bag.resBody);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Validating dependencies');
  var consoleErrors = [];
  bag.firstState = false;
  console.log(bag.dependency);
  if (!bag.dependency.version.propertyBag.shaData){
    logger.debug('state resource is empty');
    bag.firstState = true;
  }

  bag.sha = bag.dependency.version.propertyBag.shaData;
  bag.resourceId= bag.dependency.resourceId

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

  bag.consoleAdapter.publishMsg('Successfully validated dependencies');
  bag.consoleAdapter;

  return next();
}

function _getFiles(bag, next) {
  if (bag.firstState) return next();
  var who = bag.who + '|' + _getFiles.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Getting resource files');
  var query = 'sha=' + bag.sha;
  bag.builderApiAdapter.getFilesByResourceId(bag.resourceId, query,
    function (err, data) {
      var msg;
      if (err) {
        msg = util.format('%s :getFilesByResourceId failed for ' +
          'resourceId: %s with error %s', who, bag.resourceId, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(true);
        return next();
      }
      bag.outputFileJSON = data;
      logger.error(bag.outputFileJSON);
      if (_.isEmpty(bag.outputFileJSON))
        msg = 'No files found for resource';
      else
        msg = 'Successfully received files for resource';

      logger.error(bag.outputFileJSON);
      bag.consoleAdapter.publishMsg(msg);
      bag.consoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function _createFiles(bag, next) {
  if (bag.firstState) return next();
  if (_.isEmpty(bag.outputFileJSON)) return next();

  var who = bag.who + '|' + _createFiles.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Creating resource files');
  async.eachLimit(bag.outputFileJSON, 10,
    function (file, nextFile) {
      logger.error(file);
      var path = util.format('%s/%s/%s/%s', bag.buildInDir,
        bag.dependency.name, bag.dependency.type, file.path);
      logger.error('path');
      logger.error(path);
      fs.outputFile(path, file.contents,
        function (err) {
          if (err) {
            var msg = util.format('%s, Failed to create file:%s with err:%s',
              who, file, err);
            bag.consoleAdapter.publishMsg(msg);
            return nextFile(true);
          }
          return nextFile();
        }
      );
    },
    function (err) {
      if (err) {
        bag.consoleAdapter.closeCmd(false);
      } else {
        bag.consoleAdapter.publishMsg('Successfully created resource files');
        bag.consoleAdapter.closeCmd(true);
      }
      return next(err);
    }
  );
}

function _setPermissions(bag, next) {
  if (bag.firstState) return next();
  if (_.isEmpty(bag.outputFileJSON)) return next();

  var who = bag.who + '|' + _setPermissions.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.openCmd('Setting resource files permissions');
  async.eachLimit(bag.outputFileJSON, 10,
    function (file, nextFile) {
      var path = util.format('%s/%s/%s/%s', bag.buildInDir,
        bag.dependency.name, bag.dependency.type, file.path);
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
      if (err) {
        bag.consoleAdapter.closeCmd(false);
      } else {
        bag.consoleAdapter.publishMsg('Successfully set resource files ' +
          'permissions');
        bag.consoleAdapter.closeCmd(true);
      }
      return next(err);
    }
  );
}
