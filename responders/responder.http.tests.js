///////////////////////////////////////////
//DEPENDENCIES
///////////////////////////////////////////
var request = require('request'),
	configloader = require('../loadconfig.js'),
	zmq = require("zmq"),
	inspect = require('util').inspect,
	serverid = process.pid,
	mongo = require('mongojs'),

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
///////////////////////////////////////////
//SOCKET CONFIGURATION
///////////////////////////////////////////
var socket = zmq.createSocket('rep');
socket.identity = '' + process.pid;

///////////////////////////////////////////
//MAIN LOGIC MODULE
///////////////////////////////////////////
var responder = {
	results: [{}],
	msgSerialise: function(msgObj) {
		try {
			return JSON.parse(msgObj);
		} catch (ex) {
			log.error('serialising failed, ex:' + ex);
			return null;
		}
	},
	msgHandler: function(msgObj, msgType, reqID, Env, callback) {
		var storeMsg = msgObj;
		msgObj = responder.msgSerialise(msgObj);
		msgType = msgType.toString();
		if (msgObj) {
			switch (msgType.toString()) {
			case 'vent_up':
				log.info('contacted by ventalator sending confirmation...');
				log.info('responder is ventilated, waiting on tasks');
				callback('responderHere');
				break;
			case 'test_case':
				log.info('test case received, msgObj:' + require('util').inspect(msgObj));
				var expect = msgObj.expect;
				var url = msgObj.url;
				httpTest(url, expect, function(err, result) {
					httpTesting = false;
					if (err) {
						callback(err);
					} else {
						callback(result.url + ' tested, expectation: [' + result.expectation + ']');
						responder.results.push(result);
					}

				});
				break;
			case 'start_test':
				eventID = msgObj.eventID;
				responder.results.shift();
				callback('starting test session, eventID:' + msgObj.eventID + ' ventID: ' + reqID);
				break;
			case 'end_test':
				log.info('vent sending end');
				fs.writeFile('/opt/detest/tmp/' + msgObj.eventID + '.json', JSON.stringify(responder.results), 'utf8', function(err) {
					if (!(err)) {
						callback('saved to file');
						db.write(responder.results, function(err, res) {
							if (!(err)) {
								callback('saved to db');
								callback({
									msg: 'saved to db'
								}, 'test_case_complete');
							} else {
								callback('database write fail');
								callback({
									msg: 'database write fail'
								}, 'test_case_complete');
							}

						});
					} else {
						callback('failed to save to file');
					}
				});
				break;
			default:
				callback('unknown event received, eventID: ' + require('util').inspect(msgType.toString()) + ' data:' + require('util').inspect(msgObj));
				break;
			}
		} else {
			callback('received non-objectified request, ignoring it, it was: ' + storeMsg);
		}
	}
};
var sockResponder = {
	send: function(msgObj, eventType) {
		var sendAr = [process.pid, eventType, JSON.stringify(msgObj)];
		log.info('replying with: ' + require('util').inspect(sendAr));
		socket.send(sendAr);
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
						expectaction = true;
					} else {
						expectation = false;
					}
				} else {
					expectaction = 'notmet';
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
			}
		});
	} else {
		callback(true, 'no url supplied');
	}
}
///////////////////////////////////////////
//HELPERS
///////////////////////////////////////////
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
///////////////////////////////////////////
//MAIN METHOD
///////////////////////////////////////////
log.info('HTTP test engine starting up, attempting to read from config...');
configloader('/opt/detest/config.json', function(configFromFile) {
	if (configFromFile) {
		config = configFromFile;
		log.info('...config for responder loaded');
		log.info('conecting to mongo db...');
		mongo = require('mongojs').connect(config.db.constr, ['test_results']);
		log.info('...connected sucessfully to mongo');
		log.info('Connecting to zmq socket located at: tcp://' + config.bindAddr.host + ':' + config.bindAddr.port + '...');
		socket.connect(config.bindAddr.conStr);
		log.info('socket with id: "' + socket.identity + '" is connected, ready and waiting for requests');

	} else {
		log.error('Failed to read from config');
	}
});
socket.on('message', function(envelope, id, type, data) {
			log.debug('message from test requester: envelope:["' + envelope + '"] id:["' + id + '"] type:["' + type + '"] data:["' + data + '"]');
			if (type) {
				//[id, eventName, data]
				responder.msgHandler(data, type, id, envelope, function(result) {
					log.info('MSGHAND returned: ' + result);
					result = JSON.stringify({
						test_result: result
					});
					socket.send([envelope, id, type, result]);
				});
			} else {
				log.error(data);
				var emptyret = JSON.stringify({return: null});
				socket.send(['empty', emptyret]);
			}
		});
		socket.on('error', function(err) {
			if(err)
			{
			log.error(err);	
			}
			
		});