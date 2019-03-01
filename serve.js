var lightServer = require('light-server');

var options = {
	port: 8080,
	interval: 500,
	delay: 0,
	serve: 'dist',
	proxypaths: ['/'],
	watchexps: [],
}

lightServer(options).start();
