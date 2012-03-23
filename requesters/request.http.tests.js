//dependencies
var configloader = require('../loadconfig.js'),
	zmq = require("zmq"),
	socket = zmq.createSocket('req'),
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
configloader('/opt/detest/config.json', function(configFromFile) {
	if (configFromFile.hasErr) {
		log.error('...failed to read from config, bailing out!');
		throw "config file read failed";
	} else {
		config = configFromFile;
		ventID = process.pid;
		log.info('...log file parsed sucessfully, ventID: ' + ventID);
		log.info('Binding to zmq socket located at: tcp://' + config.bindAddr.host + ':' + config.bindAddr.port + '...');
		socket.indentifier = ventID;
		var socketIdent = '' + process.pid;
		socket.identity = socketIdent;
		socket.bind(config.bindAddr.conStr, function(err) {
			socket.on('message', function(envelope, id, type, data) {
				try {
					if (data) {
						data = data.toString();
					}
					if (type) {
						type = type.toString();
					}
					if (id) {
						id = id.toString();
					}
					if (envelope) {
						envelope = envelope.toString();
					}

				} catch (ex) {

				} finally {
					log.debug('from responder: data[' + require('util').inspect(data) + '] type[' + require('util').inspect(type) + '] id[' + require('util').inspect(id) + '] envelope[' + require('util').inspect(envelope) + ']');
				}

			});
			socket.on('error', function() {
				log.error('socket encountered a error');
			});


			log.info('...Message ventalator up informing all sinks, identity is: ' + ventID);
			vent.send('vent_up', JSON.stringify({
				id: ventID,
				date: new Date().toString()
			}), function(result) {
				log.debug(result);
			});
			vent.send('vent_up', 'http_testreq', function(err, result) {
				if (result) {
					log.info('...Sinks informed, response: ' + result);
					tests.doall();
				}
			});

		});
	}
});

var tests = {
	doall: function() {
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
							log.info('sending requests for screen captures');
							httpTests.screenshot(urlsToTest, eventID, function(err, testID) {
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
							});
						}
					});
				});
			}

		});
	},
	response: function(callback) {
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
				});
				httpTests.all(urlsToTest, function(err, result) {
					if (err) {
						log.error(result);
					} else {

						log.info('waiting for ops to complete...');
						setTimeout(function() {
							vent.sendSync('end_test', {
								time: new Date().getTime(),
								ventID: ventID,
								eventID: eventID
							});
						}, 5000);
					}
				});

			}
		});
	},
	screenshot: function(urlsToTest, eventID, callback) {
		httpTests.screenshot(urlsToTest, eventID, function(err, testID) {
			callback(err, testID);
		});
	}


};

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
			log.info(urls[urlI] + ' added as a http response test');
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
	},
	screenshot: function(urls, eventID, callback) {
		var testID = genID(10);
		for (var i = 0; i > urls.length; i++) {
			var url = urls[i];
			log.error('requesting screenshot of: ' + url);
			var reqObj = {
				url: url,
				eventID: eventID
			};
			vent.sendSync('shoot', reqObj);
		}
		callback(false, testID);
	}
};

var vent = {
	send: function(eventType, data, callback) {
		var msgToSend = {
			event: eventType,
			data: data,
			ventName: config.vent.name
		};
		socket.send([process.pid, 'testvent', eventType, JSON.stringify(data)]);
		callback(false, data);
		return;
	},
	sendSync: function(eventType, data) {
		socket.send([process.pid, 'testvent', eventType, JSON.stringify(data)]);
	}

};


function genID(len) {
	var valCode = [];
	for (var i = 0; i < len; i++) {
		valCode[i] = Math.floor(Math.random() * 10);
	}
	return valCode.join('');
}
