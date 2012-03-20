//dependencies
var configloader = require('./loadconfig.js'),
	zmq = require("zmq"),
	socket = zmq.createSocket('push'),
	logme = require('logme'),
	urlsToTest, ventID = genID(8),
	config, log = {
		debug: function(msg) {
			logme.debug(msg);
		},
		info: function(msg) {
			logme.info(msg);
		},
		error: function(msg) {
			logme.error(msg);
		},
		warn: function(msg) {
			logme.warning(msg);
		},
		inspect: function(obj) {
			logme.debug(require('util').inspect(obj));
		}
	};
log.info('Starting up, attempting to read from config...');
configloader('./config.json', function(configFromFile) {
	if (configFromFile.hasErr) {
		log.error('...failed to read from config, bailing out!');
		throw "config file read failed";
	} else {
		config = configFromFile;
		log.info('...log file parsed sucessfully, ventID:' + ventID);
		log.info('Binding to zmq socket located at: tcp://' + config.bindAddr.host + ':' + config.bindAddr.port + '...');
		vent.bind(config.bindAddr.conStr, function(err, result) {
			if (err) {
				throw 'failed to bind to port';
			} else {
				vent.send('vent_up', null, function(err, result) {
					if (result) {
						log.info('...Sinks informed');
						log.info('getting url\'s to test...');
						httpTests.extractUrlsFromConfig(config.tests.httpTests, function(err, result) {
							if (err) {
								log.error(result);
								throw 'could not get test urls from config';
							} else {
								urlsToTest = result;
								var eventID = genID(25);
								vent.send('start_test', {
									time: new Date().getTime(),
									ventID: ventID,
									eventID: eventID
								}, function(err, result) {
									httpTests.all(urlsToTest, function(err, result) {
										if (err) {
											log.error(result);
										} else {
											log.info('waiting for ops to complete...');
											setTimeout(function() {
												vent.send('end_test', {
													time: new Date().getTime(),
													ventID: ventID,
													eventID: eventID
												}, function(error, result) {
													log.info('all tests sent');
												});
											}, 5000);
										}
									});
								});
							}

						});
					}
				});
			}
		});
	}
});

var httpTests = {
	all: function(urls, callback) {
		var results = [{}];
		//loop through all the urls adding them to the proccessing list
		for (var urlI = 0; urlI < urls.length; urlI++) {
			var testObj = {
				url: urls[urlI],
				expect: config.tests.httpTests[urlI].expect
			};
			vent.sendSync('test_case', testObj);
			log.info(urls[urlI] + ' added as a test');
		}
		callback(false, null);
	},
	extractUrlsFromConfig: function(configTests, callback) {
		var returnArr = [];
		returnArr.shift();
		log.info('getting ' + configTests.length + ' urls from: ' + require('util').inspect(configTests));
		if (configTests) {
			for (var i = 0; i < configTests.length; i++) {
				log.info(require('util').inspect(configTests[i]));
				var test = configTests[i];
				returnArr.push(test.url);
			}
			log.info('...returning: ' + require('util').inspect(returnArr));
			callback(false, returnArr);
		} else {
			log.error('no tests passed to get urls from');
			callback(true, 'no param');
		}
	}
};
var vent = {
	send: function(eventType, data, callback) {
		var msgToSend = {
			event: eventType,
			data: data,
			ventName: config.vent.name
		};
		socket.send(JSON.stringify(msgToSend));
		callback(null, true);
	},
	sendSync: function(eventType, data) {
		var msgToSend = {
			event: eventType,
			data: data,
			ventName: config.vent.name
		};
		socket.send(JSON.stringify(msgToSend));
	},
	bind: function(bindAddr, callback) {
		socket.bind(config.bindAddr.conStr, function(err) {
			if (err) {
				log.error(err);
				callback(true, err);
			} else {
				log.info('...Message ventalator up informing all sinks...');
				socket.send(JSON.stringify({
					event: 'vent_up'
				}));

				callback(null, 'sinks informed');
			}
		});
	}
};

function genID(len) {
	var valCode = [];
	for (var i = 0; i < len; i++) {
		valCode[i] = Math.floor(Math.random() * 10);
	}
	return valCode.join('');
}
