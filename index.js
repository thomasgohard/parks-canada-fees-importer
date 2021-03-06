const TABLE_NAME = "parks-canada-fees-en";
const TABLE_DEFINITION = {
    AttributeDefinitions: [
        {
            AttributeName: 'parknamekey',
            AttributeType: 'S'
        }
    ],
    KeySchema: [
        {
            AttributeName: 'parknamekey',
            KeyType: 'HASH'
        }
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
    },
    TableName: 'parks-canada-fees-en'
};

const DDB_BATCH_LIMIT = 25;
const DDB_API_VERSION = '2012-08-10';
const DDB_LIST_TABLE_LIMIT = 100;

const OPERATIONS = {
    DELETE: 'delete',
    RENAME: function(name) {
        return name;
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
var aws = require('aws-sdk');

aws.config.update({region: 'us-east-1'});

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

function listTables(ddb, tableName) {
    return ddb.listTables({}).promise();
}

async function ddb_table_exists(ddb, tableName) {
    var tableExists = false;
    var tableNames = await listTables(ddb, tableName);
    
    if (tableNames.TableNames.includes(tableName)) {
        tableExists = true;
    }

    return tableExists;
}

function deleteTable(ddb, tableName) {
    return ddb.deleteTable({TableName: tableName}).promise();
}

async function ddb_delete_table(ddb, tableName) {
    await deleteTable(ddb, tableName);
}

function createTable(ddb, tableDefinition) {
    ddb.createTable(tableDefinition).promise();
}

async function ddb_create_table(ddb, tableDefinition) {
    await createTable(ddb, tableDefinition);
}

var dataSets = [];
for (name in DATA_SETS) {
    var url = DATA_SETS[name];
    
    dataSets.push(getDataSet(name, url));
}

Promise.all(dataSets).then(
    async function(results) {
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

        var recordCounter = 0;
        var params = {};
        params.RequestItems = {};
        params.RequestItems[TABLE_DEFINITION.TableName] = [];
        var ddb = new aws.DynamoDB({apiVersion: DDB_API_VERSION});
        var documentClient = new aws.DynamoDB.DocumentClient();
        // if table exists, delete it
        // create table
        // wait for table to have status of 'active' before writing to it
        //console.log('Table exists: ' + await ddb_table_exists(ddb, TABLE_NAME));
        if (await ddb_table_exists(ddb, TABLE_DEFINITION.TableName)) {
            console.log('Delete the table ' + TABLE_DEFINITION.TableName);
            await ddb_delete_table(ddb, TABLE_DEFINITION.TableName);
            // Note: Doesn't actually await for table to be deleted
            console.log('Table deleted');
        }
        // Note: Need to check that table actually doesn't exist
        console.log('Creating table ' + TABLE_DEFINITION.TableName);
        await ddb_create_table(ddb, TABLE_DEFINITION);
        console.log(TABLE_DEFINITION.TableName + ' created');

        var currentKey;
        var dataList = [];
        var putRequest = {};
        for (var record of dataSets['master']) {
            for (var key in record) {
                var sourceSet = DATA_SUBSTITUTIONS[key]
                if (sourceSet) {
                    var description = dataSets[sourceSet][record[key]];
                    record[key] = description;
                }

                var manipulation = MANIPULATIONS[key];
                if (manipulation) {
                    if (manipulation == OPERATIONS.DELETE) {
                        delete record[key];
                    } else {    // rename
                        record[manipulation] = record[key];
                        delete record[key];
                        key = manipulation;
                    }
                }
            }

            // Assumes 'master' is sorted by park name
            var key;
            var data = {};
            for (var property in record) {
                //if (property == TABLE_DEFINITION.KeySchema[0].AttributeName) { // primary key
                if (property == 'Park name') { // primary key
                    key = record[property];

                    if (key != currentKey) {
                        if (currentKey) {
                            putRequest = {
                                PutRequest: {
                                    Item: {}
                                }
                            };
                            putRequest.PutRequest.Item['parknamekey'] = currentKey.toLowerCase();
                            putRequest.PutRequest.Item['Park name'] = currentKey;
                            putRequest.PutRequest.Item['Fees list'] = dataList;

                            console.log('PutRequest');
                            console.log('parknamekey: ' + currentKey.toLowerCase());
                            console.log('Park name: ' + currentKey);
                            console.log('Fees list: ' + dataList.length);

                            params.RequestItems[TABLE_DEFINITION.TableName].push(putRequest);
                            console.log('Number of records (' + recordCounter + '): ' + params.RequestItems[TABLE_DEFINITION.TableName].length);

                            ++recordCounter
                            if (recordCounter % DDB_BATCH_LIMIT == 0) {
                                documentClient.batchWrite(params, function(error, data) {
                                    if (error) {
                                        console.log('Batch write failed.');
                                    }
                                });
                                recordCounter = 0;
                                params.RequestItems[TABLE_DEFINITION.TableName] = [];
                            }
                        }
                        currentKey = key;
                        dataList = [];
                    }

                    //console.log('Primary key: ' + key + '(current key: ' + currentKey + ')');
                } else {
                    data[property] = record[property];
                    //console.log(property + ' property: ' + data[property]);
                }
            }
            dataList.push(data);
        }

        putRequest = {
            PutRequest: {
                Item: {}
            }
        };
        putRequest.PutRequest.Item['parknamekey'] = currentKey.toLowerCase();
        putRequest.PutRequest.Item['Park name'] = currentKey;
        putRequest.PutRequest.Item['Fees list'] = dataList;

        console.log('PutRequest');
        console.log('parknamekey: ' + currentKey.toLowerCase());
        console.log('Park name: ' + currentKey);
        console.log('Fees list: ' + dataList.length);

        params.RequestItems[TABLE_DEFINITION.TableName].push(putRequest);
        console.log('Number of records (' + recordCounter + '): ' + params.RequestItems[TABLE_DEFINITION.TableName].length);

        documentClient.batchWrite(params, function(error, data) {
            if (error) {
                console.log('Batch write failed.');
            }
        });
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