// var global = {};

// var util = require('util.sjs');

var params = JSON.parse(xdmp.getRequestBody().toString());

var db = (params.mldb) ? params.mldb : "Documents";

var namespaceMap = {
	'cts': 'http://marklogic.com/cts',
	'fn': 'http://www.w3.org/2005/xpath-functions',
	'math':'http://marklogic.com/xdmp/math',
	'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
	'sc': 'http://marklogic.com/xdmp/schema-components',
	'sem': 'http://marklogic.com/semantics',
	'spell': 'http://marklogic.com/xdmp/spell',
	'temporal': 'http://marklogic.com/xdmp/temporal',
	'xdmp': 'http://marklogic.com/xdmp'
};

var returnType = {

};

var response = {result:null, datatype:null,error:null};
try{
	// var evalResult = xdmp.eval(params.cmd, null, {"database": xdmp.database(db)});
	// var result = (evalResult.count == 1) ? evalResult.next().value : evalResult;
	xdmp.log(params.cmd);
	var result = eval(params.cmd.replace(/^\s+|\s+$/g, ''));

	// if we're evaluating a function use xdmp.eval instead
	if(typeof(result) == 'function'){
		var details = params.cmd.split('.');
		xdmp.log(details);
	// 	result = xdmp.eval(params.cmd, null, {"database": xdmp.database(db)}).next().value;
	}

	response['result'] = result;
	response['datatype'] = response.result.constructor;
} catch(e){
	response['error'] = e;
}

xdmp.log(response);

response;