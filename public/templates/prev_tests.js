var template = '<div class="container-fluid">';
template += '<div class="row-fluid">';
template += '{{#testplans}}';
template += '<div class="span12">';
template += '<h2>{{date}}</h2>';
template += '<br /><br />';
template += '<blockquote>';
template += '<table class="table">';
template += '<thead>';
template += '<tr>';
template += '<th>URL</th>';
template += '<th>Response Time</th>';
template += '<th>HTTP Code</th>';
template += '<th>ID</th>';
template += '<th>Expectation met</th>';
template += '</tr>';
template += '</thead>';
template += '<tbody>';
template += '{{#tests}}';
template += '<tr>';
template += '<td><a class="siteLaunch" href="javascript:siteViewer(\'{{testID}}\')">{{url}}</a></td>';
template += '<td>{{timeTaken}}ms</td>';
template += '<td>{{response}}</td>';
template += '<td>{{testID}}</td>';
template += '<td>{{expectation}}</td>';
template += '</tr>';
template += '{{/tests}}';
template += '</tbody>';
template += '</table>';
template += '</div>';
template += '</blockquote>';
template += '{{/testplans}}';
template += '</div>';
exports.template += template;