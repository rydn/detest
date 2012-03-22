var phantom = require('phantom');

phantom.create(function(ph) {
	console.log('creating page');
	ph.createPage(function(page) {
		page.open('http://www.google.com', function(status) {
			console.log('page opened');
			page.eveluate('document.title', function(result) {
				console.log(result);
			});
		});
	});
});
