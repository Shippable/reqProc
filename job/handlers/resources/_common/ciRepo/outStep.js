'use strict';
var self = outStep;
module.exports = self;

function outStep(params, callback) {
  var bag = {
    inPayload: params.inPayload,
    dependency: params.dependency,
    builderApiAdapter: params.builderApiAdapter,
    consoleAdapter: params.consoleAdapter,
    replicate: false,
    newVersion: {}
  };

  bag.who = util.format('%s|job|handlers|resources|ciRepo|%s', msName,
    self.name);
  logger.verbose(bag.who, 'Starting');

  async.series([
      _checkInputParams.bind(null, bag),
      _getCiRepoProject.bind(null, bag),
      _getCiRepoProvider.bind(null, bag),
      _generateNewVersion.bind(null, bag),
      _compareVersions.bind(null, bag),
      _postNewVersion.bind(null, bag)
    ],
    function (err) {
      logger.verbose(bag.who, 'Completed');
      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.debug(who, 'Inside');

  var consoleErrors = [];

  bag.replicate = bag.dependency.versionDependencyPropertyBag &&
    bag.dependency.versionDependencyPropertyBag.replicate;

  bag.sourceName = bag.dependency.version &&
    bag.dependency.version.propertyBag &&
    bag.dependency.version.propertyBag.sourceName;

  if (!bag.replicate && !bag.sourceName)
    consoleErrors.push(
      util.format('%s is missing: dependency.version.propertyBag.sourceName',
        who)
    );

  if (!bag.replicate && !bag.dependency.version.versionName)
    consoleErrors.push(
      util.format('%s is missing: dependency.version.versionName', who)
    );

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
  return next();
}

function _getCiRepoProject(bag, next) {
  if (bag.replicate) return next();
  var who = bag.who + '|' + _getCiRepoProject.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.publishMsg('Getting project of OUT dependency');

  bag.builderApiAdapter.getProjectById(bag.dependency.projectId,
    function (err, project) {
      if (err) {
        bag.consoleAdapter.publishMsg(
          util.format('Failed to getProjectById: %s with error %s',
            bag.dependency.projectId, err));
        bag.consoleAdapter.closeCmd(false);
        return next(true);
      }

      bag.ciRepoProject = project;
      bag.consoleAdapter.publishMsg('Successfully completed.');
      return next();
    }
  );
}

function _getCiRepoProvider(bag, next) {
  if (bag.replicate) return next();
  var who = bag.who + '|' + _getCiRepoProvider.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.publishMsg('Getting provider of OUT dependency');

  bag.builderApiAdapter.getProviderById(bag.ciRepoProject.providerId,
    function (err, provider) {
      if (err) {
        bag.consoleAdapter.publishMsg(
          util.format('Failed to getProviderById: %s with error %s',
            bag.ciRepoProject.providerId, err));
        bag.consoleAdapter.closeCmd(false);
        return next(true);
      }

      bag.ciRepoProvider = provider;
      bag.consoleAdapter.publishMsg('Successfully completed.');
      return next();
    }
  );
}

function _generateNewVersion(bag, next) {
  if (bag.replicate) return next();
  var who = bag.who + '|' + _generateNewVersion.name;
  logger.debug(who, 'Inside');

  var matchingGitRepo = _.find(bag.inPayload.dependencies,
    function (dependency) {
      var isInOperation = dependency.operation === 'IN';
      var isGitRepo = dependency.type === 'gitRepo';
      var isSourceNameEqual = (dependency.version &&
        dependency.version.propertyBag &&
        dependency.version.propertyBag.sourceName) ===
        bag.sourceName;
      var isProviderEqual =
        dependency.propertyBag.normalizedRepo &&
        (dependency.propertyBag.normalizedRepo.repositoryProvider ===
        bag.ciRepoProvider.name);
      return isInOperation && isGitRepo && isSourceNameEqual && isProviderEqual;
    }
  );

  if (matchingGitRepo) {
    bag.consoleAdapter.publishMsg('Found a matching gitRepo IN step');
    var gitRepoPropertyBag = matchingGitRepo.version.propertyBag;
    bag.newVersion = {
      resourceId: bag.dependency.resourceId,
      versionName: gitRepoPropertyBag.shaData.commitSha,
      projectId: bag.dependency.projectId,
      propertyBag: {
        shaData: gitRepoPropertyBag.shaData,
        webhookRequestHeaders: gitRepoPropertyBag.webhookRequestHeaders,
        webhookRequestBody: gitRepoPropertyBag.webhookRequestBody
      }
    };
  }

  return next();
}

function _compareVersions(bag, next) {
  if (bag.replicate) return next();
  if (_.isEmpty(bag.newVersion)) return next();

  var who = bag.who + '|' + _compareVersions.name;
  logger.debug(who, 'Inside');

  bag.consoleAdapter.publishMsg('Comparing new version to original');
  var originalVersion = bag.dependency.version;

  if (originalVersion.propertyBag && originalVersion.propertyBag.trace)
    delete originalVersion.propertyBag.trace;

  if (originalVersion.versionName !== bag.newVersion.versionName) {
    bag.isChanged = true;
    bag.consoleAdapter.publishMsg('versionName has changed');

  } else if (!_.isEqual(originalVersion.propertyBag,
    bag.newVersion.propertyBag)) {

    bag.isChanged = true;
    bag.consoleAdapter.publishMsg('propertyBag has changed');
  }

  if (!bag.isChanged)
    bag.consoleAdapter.publishMsg('version has NOT changed.');
  return next();
}

function _postNewVersion(bag, next) {
  if (bag.replicate) return next();
  if (!bag.isChanged) return next();

  var who = bag.who + '|' + _postNewVersion.name;
  logger.verbose(who, 'Inside');

  bag.builderApiAdapter.postVersion(bag.newVersion,
    function (err, version) {
      var msg;
      if (err) {
        msg = util.format('%s, Failed to post version for resourceId: %s',
          who, bag.newVersion.resourceId, err);
        bag.consoleAdapter.publishMsg(msg);
        bag.consoleAdapter.closeCmd(false);
        return next(true);
      }

      msg = util.format('Post version for resourceId: %s succeeded with ' +
        'version %s', bag.newVersion.resourceId, version.versionNumber
      );
      bag.consoleAdapter.publishMsg(msg);
      return next();
    }
  );
}
