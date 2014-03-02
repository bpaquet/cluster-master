
var argv = require('optimist').argv,
	logger = require('log4node'),
	clusterMaster = require('../cluster-master.js');

logger.reconfigure({file: argv.log_file});

var sub_args = [];
Object.keys(argv).forEach(function(x) {
	if (x !== '_' && x.substring(0, 1) !== '$') {
		sub_args = sub_args.concat(['--' + x, argv[x]]);
	}
});

clusterMaster({
	exec: './worker.js',
	size: 5,
	args: sub_args,
	logger: logger.info,
	delayForRestartChecking: 500,
	delayBeforeKill: 500,
	minRestartAge: 200,
	delayBeforeRestartWhenMinRestartAge: 1000,
	delayBetweenShutdownAndDisconnect: 1000,
});