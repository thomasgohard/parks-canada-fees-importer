const DATA_SETS = {
    // 'name': 'url'
    //'master': 'http://www.pc.gc.ca/apps/tarifs-fees/XML/fees_master.xml',
    //'parks': 'http://www.pc.gc.ca/apps/tarifs-fees/XML/parksid.xml',
    //'fees': 'http://www.pc.gc.ca/apps/tarifs-fees/XML/fees.xml',
    'subFees': 'http://www.pc.gc.ca/apps/tarifs-fees/XML/subfees.xml'
};

var fs = require('fs');
var request = require('request');
var xml2js = require('xml2js');

function fetchDataSet(name, url) {
    console.log('Fetching \'' + name + '\': ' + url);
    request(url, function(error, response, body) {
        if (error) {
            console.log('Error: ' + error);
            return;
        }

        var url = response.request.href;

        if (response.statusCode != 200) {
            console.log('HTTP Error ' + response.statusCode + ' (' + response.statusMessage + ')' + ': ' + url);
            return;
        }

        var xml = body;
        var parser = new xml2js.Parser();
        parser.parseString(xml, function(error, results) {
            var subfeesData = results['subfees.xml']['I_SUBFEES'];

            for (var dataPointIndex in subfeesData) {
                var dataPoint = subfeesData[dataPointIndex];
                for (var key in dataPoint) {
                    if (dataPoint.hasOwnProperty(key)) {
                    console.log('key:' + key + '; value: ' + dataPoint[key]);
                    }
                }
            }
        })
    });
}

for (name in DATA_SETS) {
    var url = DATA_SETS[name];

    var dataSet = fetchDataSet(name, url);
    //var data = parseDataSet(name, dataSet);
}