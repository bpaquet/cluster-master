
var argv = require('optimist').argv,
	logger = require('log4node'),
	http = require('http');

logger.reconfigure({file: argv.log_file});

logger.info('Start worker', process.pid);

var server = http.createServer(function(req, res) {
	if (req.url === '/crash') {
		process.exit(1);
	}
	res.end('Hello !');
});

server.listen(8078);

process.on('disconnect', function() {
	logger.info('Bye', process.pid);
});

