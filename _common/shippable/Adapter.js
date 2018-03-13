'use strict';
var self = ShippableAdapter;
module.exports = self;
var request = require('request');

function ShippableAdapter(token) {
  logger.verbose(util.format('Initializing %s', self.name));
  this.token = token;
  this.baseUrl = config.apiUrl;
  this.headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Authorization': 'apiToken '.concat(token)
  };
}

//#######################   GET  by alphabetical order  ########################
/*
 ------------------------
 Standards:
 ------------------------
 * The parameters for this.method() in getSById should occupy
 a line of their own.

 * We're no longer using `var url`

 * `util.format` needs to be used for all routes that use an Id.

 ------------------------
 Formats:
 ------------------------

 ShippableAdapter.prototype.getSById =
 function (sId, callback) {
 this.get(
 util.format('/S/%s', sId),
 callback
 );
 };

 ShippableAdapter.prototype.getS =
 function (callback) {
 this.get('/S', callback);
 };

 ShippableAdapter.prototype.getSByParentId =
 function (parentId, callback) {
 this.get(
 util.format('/parent/%s/S', parentId),
 callback
 );
 };

 */

 ShippableAdapter.prototype.getAccountById =
   function (id, callback) {
     this.get(
       util.format('/accounts/%s', id),
       callback
     );
   };

ShippableAdapter.prototype.getAccounts =
  function (query, callback) {
    this.get(
      util.format('/accounts?' + query),
      callback
    );
  };

ShippableAdapter.prototype.getAccountIntegrationById =
  function (id, callback) {
    this.get(
      util.format('/accountIntegrations/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getAccountIntegrations =
  function (query, callback) {
    this.get(
      util.format('/accountIntegrations?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getAccountProfiles =
  function (query, callback) {
    this.get(
      util.format('/accountProfiles?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getAccountTokens =
  function (query, callback) {
    this.get(
      util.format('/accountTokens?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getArtifactUrlByBuildJobId =
  function (buildJobId, query, callback) {
    this.get(
      util.format('/buildJobs/%s/artifactUrl?%s', buildJobId, query),
      callback
    );
  };

ShippableAdapter.prototype.postAccountProfile =
  function (json, callback) {
    this.post(
      util.format('/accountProfiles'),
      json,
      callback
    );
  };

ShippableAdapter.prototype.getBuildJobById =
  function (id, callback) {
    this.get(
      util.format('/buildJobs/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getBuilds =
  function (query, callback) {
    this.get(
      util.format('/builds?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getBuildJobs =
  function (query, callback) {
    this.get(
      util.format('/buildJobs?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getJobCoverageReportsByJobId =
  function (jobId, callback) {
    this.get(
      util.format('/jobs/%s/jobCoverageReports', jobId),
      callback
    );
  };

ShippableAdapter.prototype.getBuildJobConsolesByBuildJobId =
  function (buildJobId, query, callback) {
    this.get(
      util.format('/buildJobs/%s/consoles?%s', buildJobId, query),
      callback
    );
  };

ShippableAdapter.prototype.getClusterNodes =
  function (query, callback) {
    this.get(
      util.format('/clusterNodes?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getClusterNodeById =
  function (clusterNodeId, callback) {
    this.get(
      util.format('/clusterNodes/%s', clusterNodeId),
      callback
    );
  };

ShippableAdapter.prototype.postClusterNodeStats =
  function (json, callback) {
    this.post(
      util.format('/clusterNodeStats'),
      json,
      callback
    );
  };

ShippableAdapter.prototype.getClusters =
  function (query, callback) {
    this.get(
      util.format('/clusters?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getFilesByResourceId =
  function(resourceId, query, callback) {
    this.get(
      util.format('/resources/%s/files?%s', resourceId, query),
      callback
    );
  };

ShippableAdapter.prototype.getJobs =
  function (query, callback) {
    this.get(
      util.format('/jobs?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getJobById =
  function (jobId, callback) {
    this.get(
      util.format('/jobs/%s', jobId),
      callback
    );
  };

ShippableAdapter.prototype.getCollaboratorByProjectId =
  function (projectId, callback) {
    this.get(
      util.format('/projects/%s/validCollaborator', projectId),
      callback
    );
  };

ShippableAdapter.prototype.getJobStateMaps =
  function (query, callback) {
    this.get(
      util.format('/jobStatesMap?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getMasterIntegrations =
  function (query, callback) {
    this.get(
      util.format('/masterIntegrations?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getOwnerByProjectId =
  function (projectId, callback) {
    this.get(
      util.format('/projects/%s/validOwner', projectId),
      callback
    );
  };

ShippableAdapter.prototype.getPlanById =
  function (id, callback) {
    this.get(
      util.format('/plans/%s', id),
      callback);
  };

ShippableAdapter.prototype.getProjects =
  function (query, callback) {
    this.get(
      util.format('/projects?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getProjectAccounts =
  function (query, callback) {
    this.get(
      util.format('/projectAccounts?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getProjectById =
  function (id, callback) {
    this.get(
      util.format('/projects/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getProviderById =
  function (id, callback) {
    this.get(
      util.format('/providers/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getProviders =
  function (query, callback) {
    this.get(
      util.format('/providers?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getResources =
  function (query, callback) {
    this.get(
      util.format('/resources?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getResourceById =
  function (resourceId, callback) {
    this.get(
      util.format('/resources/%s', resourceId),
      callback
    );
  };

ShippableAdapter.prototype.getRunById =
  function (runId, callback) {
    this.get(
      util.format('/runs/%s', runId),
      callback
    );
  };

ShippableAdapter.prototype.cancelRunById =
  function (runId, callback) {
    this.post(
      util.format('/runs/%s/cancel', runId), {}, callback
    );
  };

ShippableAdapter.prototype.getRuns =
  function (query, callback) {
    this.get(
      util.format('/runs?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getRuntimeTemplates =
  function (query, callback) {
    this.get(
      util.format('/runtimeTemplates?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getSubscriptions =
  function (query, callback) {
    this.get(
      util.format('/subscriptions?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getSubscriptionById =
  function (id, callback) {
    this.get(
      util.format('/subscriptions/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getSystemMachineImageById =
  function (id, callback) {
    this.get(
      util.format('/systemMachineImages/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getSystemMachineImages =
  function (query, callback) {
    this.get(
      util.format('/systemMachineImages?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getSystemNodeById =
  function (id, callback) {
    this.get(
      util.format('/systemNodes/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getSystemNodes =
  function (query, callback) {
    this.get(
      util.format('/systemNodes?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.validateSystemNodeById =
  function (systemNodeId, callback) {
    this.get(
      util.format('/systemNodes/%s/validate', systemNodeId),
      callback
    );
  };

ShippableAdapter.prototype.getSystemClusters =
  function (query, callback) {
    this.get(
      util.format('/systemClusters?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getSubscriptionAccounts =
  function (query, callback) {
    this.get(
      util.format('/subscriptionAccounts?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getSubscriptionIntegrations =
  function (query, callback) {
    this.get(
      util.format('/subscriptionIntegrations?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getSubscriptionIntegrationById =
  function (id, callback) {
    this.get(
      util.format('/subscriptionIntegrations/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getSubscriptionIntegrationPermissions =
  function (query, callback) {
    this.get(
      util.format('/subscriptionIntegrationPermissions?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getSubscriptionStateById =
  function (id, callback) {
    this.get(
      util.format('/subscriptions/%s/state', id),
      callback
    );
  };

ShippableAdapter.prototype.getSystemCodes =
  function (query, callback) {
    this.get(
      '/systemCodes?' + query,
      callback
    );
  };

ShippableAdapter.prototype.getSystemSettings =
  function (callback) {
    this.get(
      '/systemSettings',
      callback
    );
  };

ShippableAdapter.prototype.getTransactionById =
  function (id, callback) {
    this.get(
      util.format('/transactions/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getTransactions =
  function (query, callback) {
    this.get(
      util.format('/transactions?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.getValidCollaboratorByProjectId =
  function (projectId, callback) {
    var url = '/projects/' + projectId + '/validCollaborator';
    this.get(url, callback);
  };

ShippableAdapter.prototype.getVersionById =
  function (versionId, callback) {
    this.get(
      util.format('/versions/%s', versionId),
      callback
    );
  };

ShippableAdapter.prototype.getVersions =
  function (query, callback) {
    this.get(
      util.format('/versions?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.postVersion =
  function (json, callback) {
    this.post('/versions', json, callback);
  };

ShippableAdapter.prototype.putVersionById =
  function (versionId, json, callback) {
    this.put(
      util.format('/versions/%s', versionId),
      json, callback
    );
  };

// workflowControllers
ShippableAdapter.prototype.getWorkflowControllers =
  function (query, callback) {
    this.get(
      util.format('/workflowControllers?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.postWorkflowControllers =
  function (body, callback) {
    var url = '/workflowControllers';
    this.post(url, body, callback);
  };

// jobDependencies
ShippableAdapter.prototype.getJobDependencies =
  function (query, callback) {
    var url = '/jobDependencies?' + query;
    this.get(url, callback);
};

ShippableAdapter.prototype.postJobDependency =
  function (json, callback) {
    var url = '/jobDependencies';
    this.post(url, json, callback);
  };

ShippableAdapter.prototype.deleteJobDependencyById =
  function (id, callback) {
    var url = '/jobDependencies/' + id;
    this.delete(url, callback);
};

ShippableAdapter.prototype.putJobDependencyById =
  function (id, json, callback) {
    var url = '/jobDependencies/' + id;
    this.put(url, json, callback);
  };

//#######################  DELETE  by alphabetical order  ######################
ShippableAdapter.prototype.deleteBuildJobConsolesByBuildJobId =
  function (buildJobId, query, callback) {
    var url = util.format('/buildJobs/%s/consoles?%s',
      buildJobId, query);
    this.delete(url, callback);
  };

ShippableAdapter.prototype.deleteClusterNodeById =
  function (clusterNodeId, callback) {
    this.delete(
      util.format('/clusterNodes/%s', clusterNodeId),
      callback
    );
  };

ShippableAdapter.prototype.deleteClusterNodeConsolesByClusterNodeId =
  function (clusterNodeId, callback) {
    this.delete(
      util.format('/clusterNodes/%s/clusterNodeConsoles', clusterNodeId),
      callback
    );
  };

ShippableAdapter.prototype.deleteClusterNodeStatsByClusterNodeId =
  function (clusterNodeId, query, callback) {
    this.delete(
      util.format('/clusterNodes/%s/clusterNodeStats?%s', clusterNodeId, query),
      callback
    );
  };

ShippableAdapter.prototype.deleteProjectAccountById =
  function (ProjAccId, callback) {
    this.delete(
      util.format('/projectAccounts/%s', ProjAccId),
      callback
    );
  };

ShippableAdapter.prototype.deleteResourceById =
  function (resourceId, query, callback) {
    this.delete(
      util.format('/resources/%s?%s', resourceId, query),
      callback
    );
  };

ShippableAdapter.prototype.deleteSubscriptionAccountById =
  function (id, callback) {
    this.delete(
      util.format('/subscriptionAccounts/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.deleteSystemNodeStatsBySystemNodeId =
  function (systemNodeId, query, callback) {
    this.delete(
      util.format('/systemNodes/%s/systemNodeStats?%s', systemNodeId, query),
      callback
    );
  };

ShippableAdapter.prototype.deleteVersionById =
  function (versionId, callback) {
    this.delete(
      util.format('/versions/%s', versionId),
      callback
    );
  };

//#######################  POST  by alphabetical order  ########################

ShippableAdapter.prototype.enableProjectById =
  function (projectId, json, callback) {
    this.post(
      util.format('/projects/%s/enable', projectId),
      json,
      callback
    );
  };

ShippableAdapter.prototype.postBuild =
  function (json, callback) {
    this.post(
      util.format('/builds'),
      json,
      callback
    );
  };

ShippableAdapter.prototype.postBuildJobConsoles =
  function (json, callback) {
    this.post(
      util.format('/buildJobConsoles'),
      json,
      callback
    );
  };

ShippableAdapter.prototype.postBuildJob =
  function (json, callback) {
    this.post(
      util.format('/buildJobs'),
      json,
      callback
    );
  };

ShippableAdapter.prototype.postCubbyholeToken =
  function (json, callback) {
    this.post(
      util.format('/passthrough/vault/cubbyhole'),
      json,
      callback
    );
  };

ShippableAdapter.prototype.postFilesByResourceId =
  function (resourceId, json, callback) {
    this.post(
      util.format('/resources/%s/files', resourceId),
      json,
      callback
    );
  };

ShippableAdapter.prototype.postSystemNodeStats =
  function (json, callback) {
    this.post(
      util.format('/systemNodeStats'),
      json,
      callback
    );
  };

ShippableAdapter.prototype.postJob =
  function (json, callback) {
    this.post(
      '/jobs',
      json,
      callback
    );
  };

ShippableAdapter.prototype.getArtifactUrlByJobId =
  function (jobId, query, callback) {
    this.get(
      util.format('/jobs/%s/artifactUrl?%s', jobId, query),
      callback
    );
  };

ShippableAdapter.prototype.getJobConsolesByJobId =
  function (jobId, query, callback) {
    this.get(
      util.format('/jobs/%s/consoles?%s', jobId, query),
      callback
    );
  };

ShippableAdapter.prototype.postJobConsoleByJobId =
  function (jobId, body, callback) {
    this.post(
      util.format('/jobs/%s/postConsoles', jobId),
      body,
      callback
    );
  };

ShippableAdapter.prototype.deleteJobConsolesByJobId =
  function (jobId, query, callback) {
    var url = util.format('/jobs/%s/consoles?%s',
      jobId, query);
    this.delete(url, callback);
  };

ShippableAdapter.prototype.postOfflineAccount =
  function (json, callback) {
    this.post(
      '/accounts/offline',
      json,
      callback
    );
  };

ShippableAdapter.prototype.postProjectAccounts =
  function (json, callback) {
    this.post(
      '/projectAccounts',
      json,
      callback
    );
  };

ShippableAdapter.prototype.postResource =
  function (json, callback) {
    this.post(
      '/resources',
      json,
      callback
    );
  };

ShippableAdapter.prototype.postScmProject =
  function (json, callback) {
    this.post(
      '/projects/postScm',
      json,
      callback
    );
  };

ShippableAdapter.prototype.postScmSubscription =
  function (json, callback) {
    this.post(
      '/subscriptions/postScm',
      json,
      callback
    );
  };

ShippableAdapter.prototype.postSubscriptionAccounts =
  function (json, callback) {
    this.post(
      '/subscriptionAccounts',
      json,
      callback
    );
  };

ShippableAdapter.prototype.postToClusterNode =
  function (clusterNode, callback) {
    this.post(
      '/clusterNodes',
      clusterNode,
      callback
    );
  };

ShippableAdapter.prototype.postToClusterNodeConsoles =
  function (json, callback) {
    this.post(
      '/clusterNodeConsoles',
      json,
      callback
    );
  };

ShippableAdapter.prototype.postToDailyAggs =
  function (callback) {
    this.post(
      '/dailyAggs',
      {},
      callback
    );
  };

ShippableAdapter.prototype.postToProjectDailyAggs =
  function (callback) {
    this.post(
      '/projectDailyAggs',
      {},
      callback
    );
  };

ShippableAdapter.prototype.postToSubscriptionDailyAggs =
  function (callback) {
    this.post(
      '/subscriptionDailyAggs',
      {},
      callback
    );
  };

ShippableAdapter.prototype.postToVortex =
  function (message, callback) {
    this.post(
      '/vortex',
      message,
      callback
    );
  };

ShippableAdapter.prototype.postToSUVortex =
  function (message, callback) {
    this.post(
      '/vortexSU',
      message,
      callback
    );
  };

ShippableAdapter.prototype.postToVortexUrl =
  function (message, callback) {
    this.post(
      '/vortex',
      message,
      callback
    );
  };

ShippableAdapter.prototype.postTransaction =
  function (json, callback) {
    this.post(
      '/transactions',
      json,
      callback
    );
  };

ShippableAdapter.prototype.triggerNewBuildByProjectId =
  function (projectId, json, callback) {
    this.post(
      util.format('/projects/%s/newBuild', projectId),
      json,
      callback
    );
  };

ShippableAdapter.prototype.triggerNewBuildByResourceId =
  function (resourceId, json, callback) {
    this.post(
      util.format('/resources/%s/triggerNewBuildRequest', resourceId),
      json,
      callback
    );
  };


//#######################  PUT  by alphabetical order  ########################

ShippableAdapter.prototype.putAccountById =
  function (id, json, callback) {
    this.put(
      util.format('/accounts/%s', id),
      json,
      callback
    );
  };

ShippableAdapter.prototype.putAccountIntegration =
  function (id, json, callback) {
    this.put(
      util.format('/accountIntegrations/%s', id),
      json,
      callback
    );
  };

ShippableAdapter.prototype.putBuildById =
  function (id, json, callback) {
    this.put(
      util.format('/builds/%s', id),
      json,
      callback
    );
  };

ShippableAdapter.prototype.putBuildJobById =
  function (buildJobId, json, callback) {
    this.put(
      util.format('/buildJobs/%s', buildJobId),
      json,
      callback
    );
  };

ShippableAdapter.prototype.putClusterNodeById =
  function (clusterNodeId, clusterNode, callback) {
    this.put(
      util.format('/clusterNodes/%s', clusterNodeId),
      clusterNode,
      callback
    );
  };

ShippableAdapter.prototype.putJobById =
  function (id, json, callback) {
    this.put(
      util.format('/jobs/%s', id),
      json,
      callback
    );
  };

ShippableAdapter.prototype.putProjectById =
  function (id, json, callback) {
    this.put(
      util.format('/projects/%s', id),
      json,
      callback
    );
  };

ShippableAdapter.prototype.putResourceById =
  function (id, json, callback) {
    this.put(
      util.format('/resources/%s', id),
      json,
      callback
    );
  };

ShippableAdapter.prototype.putRunById =
  function (runId, body, callback) {
    this.put(
      util.format('/runs/%s', runId),
      body,
      callback
    );
  };

ShippableAdapter.prototype.getSHAByAccountIntegrationId =
  function (accountIntegrationId, owner, repo, branch, callback) {
    this.get(
      util.format(
        '/passthrough/accountIntegrations/%s/repos/%s/%s/%s',
        accountIntegrationId, owner, repo, branch),
      callback
    );
  };

ShippableAdapter.prototype.getJenkinsJobsByJobname =
  function (accountIntegrationId, jobName, callback) {
    this.get(
      util.format(
        '/passthrough/accountIntegrations/%s/jenkins/%s/builds',
        accountIntegrationId, jobName),
      callback
    );
  };

ShippableAdapter.prototype.putSubscriptionById =
  function (id, json, callback) {
    this.put(
      util.format('/subscriptions/%s', id),
      json,
      callback
    );
  };

ShippableAdapter.prototype.putSystemIntegrationById =
  function (id, query, json, callback) {
    this.put(
      util.format('/systemIntegrations/%s?%s', id, query),
      json,
      callback
    );
  };

ShippableAdapter.prototype.putSystemSettings =
  function (id, json, callback) {
    this.put(
      util.format('/systemSettings/%s', id),
      json,
      callback
    );
  };


ShippableAdapter.prototype.putSystemNodeById =
  function (id, json, callback) {
    this.put(
      util.format('/systemNodes/%s', id),
      json,
      callback
    );
  };

ShippableAdapter.prototype.putTransaction =
  function (id, json, callback) {
    this.put(
      util.format('/transactions/%s', id),
      json,
      callback
    );
  };

ShippableAdapter.prototype.getSystemIntegrationById =
  function (id, callback) {
    this.get(
      util.format('/systemIntegrations/%s', id),
      callback
    );
  };

ShippableAdapter.prototype.getSystemIntegrations =
  function (query, callback) {
    this.get(
      util.format('/systemIntegrations?%s', query),
      callback
    );
  };

ShippableAdapter.prototype.validateClusterNodeById =
  function (clusterNodeId, callback) {
    this.get(
      util.format('/clusterNodes/%s/validate', clusterNodeId),
      callback
    );
  };

ShippableAdapter.prototype.deleteSystemNodeConsolesBySystemNodeId =
  function (systemNodeId, callback) {
    this.delete(
      util.format('/systemNodes/%s/systemNodeConsoles', systemNodeId),
      callback
    );
  };

ShippableAdapter.prototype.getProviderById =
  function (providerId, callback) {
    this.get(
      util.format('/providers/%s', providerId),
      callback
    );
  };

ShippableAdapter.prototype.get =
  function (relativeUrl, callback) {
    var bag = {};
    bag.opts = {
      method: 'GET',
      url: this.baseUrl.concat(relativeUrl),
      headers: this.headers
    };
    bag.who = util.format('%s call to %s', bag.opts.method, bag.opts.url);
    logger.debug(util.format('Starting %s', bag.who));

    async.series([
        _performCall.bind(null, bag),
        _parseBody.bind(null, bag)
      ],
      function () {
        callback(bag.err, bag.parsedBody, bag.res);
      }
    );
  };

ShippableAdapter.prototype.post =
  function (relativeUrl, json, callback) {
    var bag = {};
    bag.opts = {
      method: 'POST',
      url: this.baseUrl.concat(relativeUrl),
      headers: this.headers,
      json: json
    };
    bag.who = util.format('%s call to %s', bag.opts.method, bag.opts.url);
    logger.debug(util.format('Starting %s', bag.who));

    async.series([
        _performCall.bind(null, bag),
        _parseBody.bind(null, bag)
      ],
      function () {
        callback(bag.err, bag.parsedBody, bag.res);
      }
    );
  };

ShippableAdapter.prototype.put =
  function (relativeUrl, json, callback) {
    var bag = {};
    bag.opts = {
      method: 'PUT',
      url: this.baseUrl.concat(relativeUrl),
      headers: this.headers,
      json: json
    };
    bag.who = util.format('%s call to %s', bag.opts.method, bag.opts.url);
    logger.debug(util.format('Starting %s', bag.who));

    async.series([
        _performCall.bind(null, bag),
        _parseBody.bind(null, bag)
      ],
      function () {
        callback(bag.err, bag.parsedBody, bag.res);
      }
    );
  };

ShippableAdapter.prototype.delete =
  function (relativeUrl, callback) {
    var bag = {};
    bag.opts = {
      method: 'DELETE',
      url: this.baseUrl.concat(relativeUrl),
      headers: this.headers
    };
    bag.who = util.format('%s call to %s', bag.opts.method, bag.opts.url);
    logger.debug(util.format('Starting %s', bag.who));

    async.series([
        _performCall.bind(null, bag),
        _parseBody.bind(null, bag)
      ],
      function () {
        callback(bag.err, bag.parsedBody, bag.res);
      }
    );
  };

function _performCall(bag, next) {
  var who = bag.who + '|' + _performCall.name;
  logger.debug(who, 'Inside');

  bag.startedAt = Date.now();
  bag.timeoutLength = 1;
  bag.timeoutLimit = 180;

  __attempt(bag, next);

  function __attempt(bag, callback) {
    request(bag.opts,
      function (err, res, body) {
        var interval = Date.now() - bag.startedAt;
        var connectionError = false;

        if (res)
          logger.debug(
            util.format('%s took %s & returned status %s', bag.who, interval,
              res.statusCode)
          );
        else
          connectionError = true;

        if (res && res.statusCode > 299)
          err = err || res.statusCode;

        if ((res && res.statusCode > 299) || err) {
          if ((res && res.statusCode >= 500) || connectionError) {
            logger.error(
              util.format('%s returned error. Retrying in %s seconds',
                bag.who, bag.timeoutLength*2)
            );
            bag.timeoutLength *= 2;
            if (bag.timeoutLength > bag.timeoutLimit)
              bag.timeoutLength = 1;

            setTimeout(function () {
              __attempt(bag, callback);
            }, bag.timeoutLength * 1000);

            return;
          } else {
            logger.warn(util.format('%s returned status %s with error %s',
              bag.who, res && res.statusCode, err));
            bag.err = err;
          }
        }
        bag.res = res;
        bag.body = body;
        callback();
      }
    );
  }
}

function _parseBody(bag, next) {
  var who = bag.who + '|' + _parseBody.name;
  logger.debug(who, 'Inside');

  if (bag.body) {
    if (typeof bag.body === 'object') {
      bag.parsedBody = bag.body;
    } else {
      try {
        bag.parsedBody = JSON.parse(bag.body);
      } catch (e) {
        logger.error('Unable to parse bag.body', bag.body, e);
        bag.err = e;
      }
    }
  }
  return next();
}
