const OPERATIONS = {
    DELETE: 'delete',
    KEEP: 'keep',
    RENAME: function(name) {
        return 'rename(' + name + ')';
    }
};

const DATA_SETS = {
    // 'name': 'url'
    'master': 'http://www.pc.gc.ca/apps/tarifs-fees/XML/fees_master.xml',
    'parks': 'http://www.pc.gc.ca/apps/tarifs-fees/XML/parksid.xml',
    'fees': 'http://www.pc.gc.ca/apps/tarifs-fees/XML/fees.xml',
    'subfees': 'http://www.pc.gc.ca/apps/tarifs-fees/XML/subfees.xml'
};

const EMPTY_ATTRIBUTES = {
    'master': [
        'FEESMASTER.xml',
        'I_MAIN'
    ],
    'parks': [
        'pRK.xml',
        'I_PRKS'
    ],
    'fees': [
        'fees.xml',
        'I_FEES'
    ],
    'subfees': [
        'subfees.xml',
        'I_SUBFEES'
    ]
};

const MANIPULATIONS = {
    'master': {
        'PRICE_WITH_GST_EN': OPERATIONS.RENAME('Fee'),
        'PRICE_WITH_GST_FR': OPERATIONS.DELETE,
        'ZMASTER_ID': OPERATIONS.DELETE,
        'ZPARK_ID': OPERATIONS.RENAME('Park name'),
        'ZFEE_ID': OPERATIONS.RENAME('Fee type'),
        'ZSUBFEE_ID': OPERATIONS.RENAME('Fee class'),
        'FEEDESC_ENG': OPERATIONS.RENAME('Fee description'),
        'FEEDESC_FRE': OPERATIONS.DELETE,
        'NATIONAL_OR_LOCAL': OPERATIONS.DELETE,
        'TRAVEL_TRADE': OPERATIONS.DELETE,
        'PURPOSE': OPERATIONS.DELETE,
        'CLASS': OPERATIONS.DELETE,
        'COMM_ENG': OPERATIONS.DELETE,
        'COMM_FRE': OPERATIONS.DELETE,
        'COMM_ENG_URL': OPERATIONS.DELETE,
        'COMM_FRE_URL': OPERATIONS.DELETE,
        'NEWORREVISED': OPERATIONS.DELETE
    }
};

const DATA_SET_TRANSFORMATIONS = {
    'parks': {
        'id': 'ZPARK_ID',
        'description': 'LOW_ENG_FULL'
    },
    'fees': {
        'id': 'ZFEE_ID',
        'description': 'EN_DESCRIPTION'
    },
    'subfees': {
        'id': 'ZSUBFEE_ID',
        'description': 'EN_DESCRIPTION'
    }
};

const DATA_SUBSTITUTIONS = {
    'ZPARK_ID': 'parks',
    'ZFEE_ID': 'fees',
    'ZSUBFEE_ID': 'subfees'
};

var request = require('request-promise-native');
var xml2js = require('xml2js-es6-promise');

function getURL(url) {
    return request(url);
}

function convertXMLToJS(xml) {
    return xml2js(xml, {explicitArray: false});
}

async function getDataSet(name, url) {
    console.log('Fetching \'' + name + '\': ' + url);

    var dataSet = await getURL(url);
    dataSet = await convertXMLToJS(dataSet);
    dataSet = dataSet[EMPTY_ATTRIBUTES[name][0]];
    dataSet[name] = dataSet[EMPTY_ATTRIBUTES[name][1]];
    delete dataSet[EMPTY_ATTRIBUTES[name][1]];

    return dataSet;
}

var dataSets = [];
for (name in DATA_SETS) {
    var url = DATA_SETS[name];
    
    dataSets.push(getDataSet(name, url));
}

Promise.all(dataSets).then(
    function(results) {
        dataSets = {};
        for (var dataSet of results) {
            var name = Object.keys(dataSet)[0];
            var data = dataSet[name];
            dataSets[name] = data;
        }
        
        var data_sets_to_transform = Object.keys(DATA_SET_TRANSFORMATIONS);
        for (var name of data_sets_to_transform) {
            idKey = DATA_SET_TRANSFORMATIONS[name]['id'];
            descriptionKey = DATA_SET_TRANSFORMATIONS[name]['description'];

            var dataSet = {}
            for (var record of dataSets[name]) {
                var id = record[idKey];
                var description = record[descriptionKey];

                dataSet[id] = description;
            }
            dataSets[name] = dataSet;
        }

        for (var record of dataSets['master']) {
            for (var key in record) {
                var sourceSet = DATA_SUBSTITUTIONS[key]
                if (sourceSet) {
                    var description = dataSets[sourceSet][record[key]];
                    record[key] = description;
                }
            }
        }

        // delete/rename colums from master as necessary
    },
    function(error) {
        console.log(error);
    }
);

/*console.log(OPERATIONS.KEEP);
for (dataSet in MANIPULATIONS) {
    console.log(dataSet);
    for (field in MANIPULATIONS[dataSet]) {
        console.log(field + ': ' + MANIPULATIONS[dataSet][field]);
    }
}*/