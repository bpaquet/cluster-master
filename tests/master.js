
var argv = require('optimist').argv,
	logger = require('log4node'),
	clusterMaster = require('../cluster-master.js');

logger.reconfigure({file: argv.log_file});

clusterMaster({
	exec: './worker.js',
	size: 5,
	args: [ '--deep', 'doop', '--log_file', argv.log_file],
	logger: logger.info,
	delayForRestartChecking: 500,
	delayBeforeKill: 500,
	minRestartAge: 200,
});