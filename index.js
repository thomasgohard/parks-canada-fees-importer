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
    },
    'parks': {
        'ZPARK_ID': OPERATIONS.KEEP,
        'UP_ENG_FULL': OPERATIONS.KEEP,
        'UP_FRE_FULL': OPERATIONS.DELETE,
        'LOW_ENG_FULL': OPERATIONS.DELETE,
        'LOW_FRE_FULL': OPERATIONS.DELETE,
        'LOW_ENG': OPERATIONS.DELETE,
        'LOW_FRE': OPERATIONS.DELETE,
        'UP_ALPHA_FR_FULL': OPERATIONS.DELETE,
        'LOW_FR_NAME_1ST': OPERATIONS.DELETE,
        'UP_NO_EN_FULL': OPERATIONS.DELETE,
        'UP_NO_FR_FULL': OPERATIONS.DELETE
    },
    'fees': {
        'ZFEE_ID': OPERATIONS.KEEP,
        'EN_DESCRIPTION': OPERATIONS.KEEP,
        'FR_DESCRIPTION': OPERATIONS.DELETE
    },
    'subfees': {
        'ZFEE_ID': OPERATIONS.KEEP,
        'EN_DESCRIPTION': OPERATIONS.KEEP,
        'FR_DESCRIPTION': OPERATIONS.DELETE
    }
};

const PARKID = 'ZPARK_ID';
const FEEID = 'ZFEE_ID';
const SUBFEEID = 'ZSUBFEEID';

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
        console.log(results);
    },
    function(error) {
        console.log(error);
    }
);

/*for (var dataSet in dataSets) {
    console.log('Data set: ' + dataSet);
    console.log('Data set records: ' + Object.keys(dataSets[dataSet]).length);
}*/

/*console.log(OPERATIONS.KEEP);
for (dataSet in MANIPULATIONS) {
    console.log(dataSet);
    for (field in MANIPULATIONS[dataSet]) {
        console.log(field + ': ' + MANIPULATIONS[dataSet][field]);
    }
}*/