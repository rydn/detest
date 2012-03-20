var request = require('request'),
	configloader = require('./loadconfig.js'),
	zmq = require("zmq"),
	mongo = require('mongojs'),
	socket = zmq.createSocket('pull'),
	eventID, logme = require('logme'),
	fs = require('fs'),
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
log.info('HTTP sink starting up, attempting to read from config...');
configloader('./config.json', function(configFromFile) {
	config = configFromFile.httpSink;
	mongo = require('mongojs').connect(config.db.constr, ['test_results']);
	log.info('...config for sink loaded');
	log.info('Binding to zmq socket located at: tcp://' + config.bindAddr.host + ':' + config.bindAddr.port + '...');
	socket.connect(config.bindAddr.conStr);
	log.info('...connected to bound socket waiting for ventalators');

	socket.on('message', function(data) {
		log.debug('message from ventalator:' + data.toString());
		if (data) {
			sink.msgHandler(data);
		}
	});
});

var sink = {
	results: [{}],
	msgHandler: function(msgObj) {
		msgObj = JSON.parse(msgObj);
		switch (msgObj.event) {
		case 'vent_up':
			log.info('contacted by ventalator sending confirmation...');
			socket.send('sinkHere');
			log.info('sink is ventilated, waiting on tasks');
			break;
		case 'test_case':
			log.info('test case received, msgObj:' + require('util').inspect(msgObj));
			var expect = msgObj.data.expect;
			var url = msgObj.data.url;
			httpTest(url, expect, function(err, result) {
				httpTesting = false;
				if (err) {
					log.error(result);
				} else {
					log.info(result.url + ' tested, expectation: [' + result.expectation + ']');
					sink.results.push(result);

				}
			});
			break;
		case 'start_test':
			eventID = msgObj.data.eventID;
			sink.results.shift();
			log.info('starting test session, eventID:' + msgObj.data.eventID + ' ventID: ' + msgObj.data.ventID);
			break;
		case 'end_test':
			log.info('vent sending end');
			fs.writeFile('./tmp/' + msgObj.data.eventID + '.json', JSON.stringify(sink.results), 'utf8', function(err) {
				if (!(err)) {
					log.info('saved to file');
					db.write(sink.results, function(err, res) {
						if (!(err)) {
							log.info('saved to db');
						} else {
							log.error('database write fail');
						}

					});
				} else {
					log.error('failed to save to file');
				}
			});
			break;
		default:
			log.warn('unknown event received, data:' + require('util').inspect(msgObj));
			break;
		}
	}
};

var httpTesting = false;

function httpTest(url, expect, callback) {
	httpTesting = true;
	var start = new Date().getTime();
	var expectaction = 'notmet';
	if (url) {
		request(url, function(error, response, body) {
			var end = new Date().getTime();
			var total = end - start;
			if (error) {
				callback(true, error);
			} else {
				if (expect.type == 'responseCode') {
					if (response.code == expect.data) {
						expectaction = 'met';
					} else {
						expectaction = 'notmet';
					}
				}
				if (expect.type == 'body') {
					if (expect.data == body) {
						expectaction = 'met';
					} else {
						expectation = 'notmet';
					}
				} else {
					expectaction = 'notmet';
				}
			}
			var responseObj = {
				response: response.statusCode,
				body: body,
				timeTaken: total,
				expectation: expectaction,
				url: url,
				completed: new Date().toString(),
				testID: genID(8),
				eventID: eventID
			};
			callback(false, responseObj);
		});
	} else {
		callback(true, 'no url supplied');
	}
}
//array of chars to use
var CHARS = '0123456789abcdefghijklmnopqrstuvwxyz'.split('');

function genID(len, radix) {
	var chars = CHARS,
		uuid = [],
		i;
	radix = radix || chars.length;

	if (len) {
		for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random() * radix];
	} else {
		var r;
		uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
		uuid[14] = '4';
		for (i = 0; i < 36; i++) {
			if (!uuid[i]) {
				r = 0 | Math.random() * 16;
				uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
			}
		}
	}
	return uuid.join('');
}
var db = {
	write: function(result, callback) {
		try {
			mongo.test_results.save(result, function(err) {
				if (err) {
					log.error(err);
					callback(true, err);
				} else {
					log.info('results saved to db, results:' + result);
					callback(false, 'saved');
				}
			});
		} catch (ex) {
			log.error(ex);
			try {
				mongo.test_results.save(result, function(err) {
					if (err) {
						log.error(err);
						callback(true, err);
					} else {
						log.info('results saved to db, results:' + result);
						callback(false, 'saved');
					}
				});
			} catch (ex) {
				log.error(ex);
			}
		}
	}
};
