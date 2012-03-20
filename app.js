var configloader = require('./loadconfig.js'),
	express = require('express'),
	logme = require('logme'),
	mustache = require('mustache'),
	moment = require('moment'),
	testplans = [],
	inspect = require('util').inspect,
	config, mongo, log = {
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
var app = express.createServer();

///////////////////////////////////////////////////////
//EXPRESS CONFIG
///////////////////////////////////////////////////////
app.configure(function() {
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(app.router);
	app.use(express.static(__dirname + '/public/'));
});
//setup error handling 
app.error(function(err, req, res, next) {
	log.error('router caught a error it is: "' + err + "'");
	res.send('<h2>' + config.errorText + '</h2>');
});

///////////////////////////////////////////////////////
//ROUTES
///////////////////////////////////////////////////////
//catch all
app.get('/*', function(req, res, next) {
	//get date for log
	var date = new Date();
	//formats the date and puts it back
	date = moment(date).format("dddd, MMMM Do YYYY, h:mm:ss a");
	//log the request
	if (config.http_server.logRequests) {
		log.info('[' + date + '] ' + req.connection.remoteAddress + ' --' + req.method + '--> ' + req.url);
	}
	//set header to turnoff xss protection on the server side
	//allows for cross coms and is mostly needed
	res.header("Access-Control-Allow-Origin", "*");
	next();
});
//get all previouse tests
app.get('/tests/', function(req, res) {
	//get all data
	var test_dates = [];
	var test_ids = [];
	var tests = [];
	testplans.shift();
	test_dates.shift();
	test_ids.shift();
	tests.shift();
	mongo.test_results.find(function(err, testsFromDb) {
		tests = testsFromDb;
		for (var testi = 0; testi < tests.length; testi++) {
			var test = tests[testi];
			var date = new Date(test.completed);
			date = moment(date).format("dddd, MMMM Do YYYY");
			test_dates.push(date);
			test_ids.push(test.eventID);
		}
		test_ids = uniqueArray(test_ids);
		test_dates = uniqueArray(test_dates);
		log.debug('unique days found: ' + inspect(test_dates) + ' unique ids found: ' + inspect(test_ids) + ' total results found:' + tests.length);
		var dataForTemp = [{}];
		for (var ische = 0; ische < test_ids.length; ische++) {
			var id = test_ids[ische];
			var datein = test_dates[ische];
			getTestPlan(id, datein);
		}
		var waitForRes = setInterval(function(){
			if((testplans)&&(testplans !==[])&&(testplans !==[undefined]))
			{
				var template = require('./public/templates/prev_tests.js').template;
				var html = mustache.to_html(template, {testplans: testplans});
				html = html.replace('undefined', '');
				res.send(html);
				clearInterval(waitForRes);
			}
			else
			{
				log.debug('waiting...');
			}
		}, 50);
		
	});
});
///////////////////////////////////////////////////////
//START
///////////////////////////////////////////////////////
//load config
configloader('./config.json', function(configFromFile) {
	if (configFromFile.hasEr) {
		log.error('failed to load config, bailing');
		throw 'config file could not be loaded';
	} else {
		testplans.shift();
		config = configFromFile;
		mongo = require('mongojs').connect(config.db.constr, ['test_results']);
		app.listen(config.http_server.port);
		log.info('http server now running on port:' + config.http_server.port);
	}
});

function getTestPlan(id, date) {
	mongo.test_results.find({
		eventID: id
	}, function(err, tests) {
		if (!(err)) {
			var testplan = {
				date: date,
				id: id,
				tests: tests
			};
			if (testplan)
			{
				testplans.push(testplan);	
			}
			return testplan;
		} else {
			logger.error(err);
			return null;
		}
	});
}

function uniqueArray(arr) {
	var a = [];
	var l = arr.length;
	for (var i = 0; i < l; i++) {
		for (var j = i + 1; j < l; j++) {
			// If arr[i] is found later in the array
			if (arr[i] === arr[j]) j = ++i;
		}
		a.push(arr[i]);
	}
	return a;
}
