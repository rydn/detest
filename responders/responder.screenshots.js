///////////////////////////////////////////
//DEPENDENCIES
///////////////////////////////////////////
var Image = require("node-wkhtml").image({
    width: 960
}),
    imgFolder = '../public/site-images/',
    request = require('request'),
    configloader = require('../loadconfig.js'),
    zmq = require("zmq"),
    serverid = process.pid,
    mongo = require('mongojs'),
    inspect = require('util').inspect,
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
var socket = zmq.createSocket('xrep');
socket.identity = '' + serverid;
socket.on('message',function(envelope, id, type, data) {
    log.debug('message from test requester: "' + data.toString() + '"');
    if (data) {
        screenshooter.msgHandler(data);
    }
});
///////////////////////////////////////////
//MAIN METHOD
///////////////////////////////////////////
var screenshooter = {
    shoot: function(url, callback) {
        log.info('getting img of: ' + url);
        var imgFilename = genFileName(10, true);
        new Image({
            url: url
        }).convertAs(imgFolder + imgFilename, function(err) {
            if (err) {
                log.error('failed to save html to img, err: ' + err);
                callback(true, null);
            } else {
                log.info('html to image complete');
                var returnData = {
                    filename: imgFilename
                };
                callback(false, returnData);
            }
        });
    },
    msgHandler: function(msgObj) {
        msgObj = JSON.parse(msgObj);
        switch (msgObj.event) {
        case 'vent_up':
            log.info('contacted by ventalator sending confirmation...');
            socket.send(JSON.stringify({
                event: 'sinkup',
                data: {
                    sinkid: process.pid,
                    date: new Date().toString
                }
            }));
            log.info('sink is ventilated, waiting on tasks');
            break;
        case 'shoot':
            var url = msgObj.data.url;
            var eventID = genFileName(8, false);
            var start = new Date().getTime();
            var testID = msgObj.data.testID;
            screenshooter.shoot(url, function(hasErr, imgData) {
                if (!(hasErr)) {
                    var end = new Date();
                    var duration = start - end;
                    log.info('page image captured, took: ' + duration + 'ms');
                    var objToSave = {
                        fileName: imgData.filename,
                        completed: end.toString(),
                        testID: testID,
                        url: url,
                        eventID: genFileName(10, false),
                        took: duration
                    };
                    mongo.page_images.save(objToSave, function(err) {
                        if (!(err)) {
                            log.info('event recorded to db');
                        } else {
                            log.error('failed to log event to db, err:' + err);
                        }
                    });
                }
            });
            break;
        }
    }
};
///////////////////////////////////////////
//UTIL FUNCTIONS
///////////////////////////////////////////

function genFileName(len, filename) {
    var valCode = [];
    for (var i = 0; i < len; i++) {
        valCode[i] = Math.floor(Math.random() * 10);
    }
    if (filename) {
        return 'htmlImage_' + valCode.join('') + '.png';
    } else {
        return valCode.join('');
    }
}
///////////////////////////////////////////
//INIT
///////////////////////////////////////////
log.info('HTTP screenshot shooter responder starting up, attempting to read from config...');
configloader('/opt/detest/config.json', function(configFromFile) {
    config = configFromFile;
    mongo = require('mongojs').connect(config.db.constr, ['page_images']);
    log.info('...config for sink loaded');
    log.info('Connecting to zmq socket located at: tcp://' + config.bindAddr.host + ':' + config.bindAddr.port + '...');
    socket.connect(config.bindAddr.conStr);
    log.info('socket with id: "' + socket.identity + '" is connected, ready and waiting for requests ');
});
