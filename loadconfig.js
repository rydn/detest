var fs = require('fs');
module.exports = function(configFile, callback) {
	fs.readFile(configFile, 'utf8', function(err, data) {
		if (err) {
			callback({});
		} else {
			if (data) {
				callback(JSON.parse(data));
			} else {
				callback(JSON.parse({
					hasErr: true
				}));
			}
		}
	});
};
