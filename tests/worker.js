
var argv = require('optimist').argv,
	logger = require('log4node'),
	http = require('http');

logger.reconfigure({file: argv.log_file});

logger.info('Start worker', process.pid);

if (argv.parse_now) {
	JSON.parse(require('fs').readFileSync(argv.parse_now).toString());
}

var server = http.createServer(function(req, res) {
	if (req.url === '/crash') {
		process.exit(1);
	}
	res.end('Hello !');
});

if (argv.parse_listening) {
	server.once('listening', function() {
		setTimeout(function() {
			JSON.parse(require('fs').readFileSync(argv.parse_listening).toString());
		}, 20);
	});
}

server.listen(8078);

process.on('disconnect', function() {
	logger.info('Bye', process.pid);
});

