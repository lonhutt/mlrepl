// var global = {};

// var util = require('util.sjs');

var params = JSON.parse(xdmp.getRequestBody().toString());

var db = (params.mldb) ? params.mldb : "Documents";

var response = {result:null, datatype:null,error:null};
try{
	response['result'] = xdmp.eval(params.cmd, null, {"database": xdmp.database(db)});
	response['datatype'] = response.result.constructor;
} catch(e){
	response['error'] = e;
}

response;