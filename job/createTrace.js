'use strict';

var self = createTrace;
module.exports = self;

function createTrace(externalBag, callback) {
  var bag = {
    inPayload: _.clone(externalBag.inPayload),
    consoleAdapter: externalBag.consoleAdapter
  };
  bag.who = util.format('%s|job|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _createTrace.bind(null, bag)
    ],
    function (err) {
      var result;
      if (err) {
        logger.error(bag.who, util.format('Failed to create trace'));
      } else{
        logger.info(bag.who, 'Successfully created trace');
        result = {
          inPayload: bag.inPayload,
          trace: bag.trace
        };
      }
      return callback(err, result);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'inPayload',
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

function _createTrace(bag, next) {
  if (!_.isArray(bag.inPayload.dependencies)) return next();

  bag.consoleAdapter.openGrp('Creating trace');
  bag.consoleAdapter.openCmd('Creating trace from dependencies');
  var who = bag.who + '|' + _createTrace.name;
  logger.verbose(who, 'Inside');

  bag.trace = [];
  _.each(bag.inPayload.dependencies,
    function (dependency) {
      if (dependency.operation !== 'IN' && dependency.operation !== 'OUT')
        return;

      var resourceType = _.findWhere(global.systemCodes,
        {name: dependency.type, group: 'resource'});

      var traceObject = {
        operation: dependency.operation,
        resourceId: dependency.resourceId,
        resourceName: dependency.name,
        resourceTypeCode: (resourceType && resourceType.code) || null,
        versionId: null,
        versionNumber: null,
        versionName: null,
        versionCreatedAt: null,
        usedByVersionId: 0 // Save 0 for the current version
      };

      if (dependency.operation === 'OUT' || !dependency.version) {
        bag.trace.push(traceObject);
        return;
      }

      traceObject.versionId = dependency.version.versionId;
      traceObject.versionNumber = dependency.version.versionNumber;
      traceObject.versionName = dependency.version.versionName;
      traceObject.versionCreatedAt = dependency.version.createdAt;

      bag.trace.push(traceObject);

      if (!dependency.version.propertyBag) return;

      _.each(dependency.version.propertyBag.trace,
        function (dependencyTraceObject) {
          if (dependencyTraceObject.operation !== 'IN')
            return;
          if (dependencyTraceObject.usedByVersionId === 0)
            dependencyTraceObject.usedByVersionId =
              dependency.version.versionId;

          var isDuplicate = _.findWhere(bag.trace,
            {
              operation: dependencyTraceObject.operation,
              resourceId: dependencyTraceObject.resourceId,
              versionId: dependencyTraceObject.versionId,
              usedByVersionId: dependencyTraceObject.usedByVersionId
            }
          );

          if (!isDuplicate)
            bag.trace.push(dependencyTraceObject);
        }
      );
    }
  );

  bag.consoleAdapter.publishMsg('Successfully generated trace');
  bag.consoleAdapter.closeCmd(true);
  bag.consoleAdapter.closeGrp(true);
  return next();
}
