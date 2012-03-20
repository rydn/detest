$(document).ready(function() {
	$.get('/tests/', function(data) {
		$('#content').html(data);
	});

});

function siteViewer(testID)
{
	
}