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

var getObjectProperties = function(obj){
  var props = Object.getOwnPropertyNames(obj);
  var result = {}
  for(var i in props){
    result[props[i]] = obj[props[i]];
  }
  return result;
};

var getReturnType = function(f){
  // var arr = f.split('.');
  var mtype = f;
  var jstype = null;
  
  if(mtype.slice(-1) === '*' || mtype.slice(-1) === '+'){
  	jstype = getObjectProperties(ValueIterator.prototype);
  } else if(mtype.indexOf('xs:integer') > -1  || mtype.indexOf('xs:double') > -1 || mtype.indexOf('xs:decimal') > -1 || mtype.indexOf('xs:numeric') > -1 || mtype.indexOf('xs:unsignedLong') > -1){
    jstype = getObjectProperties(Number);
  } else if(mtype.indexOf('xs:boolean') > -1){
  	jstype = getObjectProperties(Boolean);
  } else if(mtype.indexOf('xs:date') > -1){
  	jstype = getObjectProperties(Date)
  } else if(mtype.indexOf('json:array') > -1){
  	jstype = getObjectProperties(Array);
  } else if(mtype.indexOf('function(*)') > -1){
  	jstype = getObjectProperties(Value.prototype);
  } else if(mtype.indexOf('empty-sequence()') > -1) {
  	jstype = null;
  } else if(mtype.indexOf('element()') > -1){
  	jstype = getObjectProperties(Element.prototype);
  } else if(mtype.indexOf('map:map') > -1){
  	jstype = getObjectProperties(Object);
  } else if(mtype.indexOf('node()') > -1){
  	jstype = getObjectProperties(Node.prototype);
  } 
  else {
  	jstype = getObjectProperties(String);
  }
  
  return {mlType: mtype, jstype: jstype};
};

var response = {result:undefined, datatype:undefined, error:undefined};
try{
	var result = eval(params.cmd);

	if(typeof(result) == 'function'){
		var details = params.cmd.split("\n").slice(-1)[0].split('.');

		// xdmp.log(details[details.length-2].trim() + " :: " + details[details.length-1].trim());
		// xdmp.log(details[details.length-2].trim().split(""));

		if(details.length > 1){
			if(namespaceMap[details[details.length-2].trim()]){

				var returnType = xdmp.functionReturnType(xdmp.function(fn.QName(namespaceMap[details[details.length-2].trim()], details[details.length-1].trim())));
				result = getReturnType(returnType).jstype;
			}
		}
		
	}

	response['result'] = (result) ? result : undefined;
	response['datatype'] = (result) ? Object.getPrototypeOf(result) : undefined;
} catch(e){
	xdmp.log(e);
	response['error'] = {name: e.name, message: e.stack};
}

// xdmp.log(response);

response;