// var global = {};

var util = require('util.sjs');

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

  if(util.isArray(obj)){
    obj = Array.prototype;
  } else if(util.isBoolean(obj)){
    obj = Boolean.prototype;
  } else if(util.isDate(obj)){
    obj = Date.prototype;
  } else if(util.isNumber(obj)){
    obj = Number.prototype;
  } else if(util.isString(obj)){
    obj = String.prototype;
  } else if(util.isRegExp(obj)){
    obj = RegExp.prototype;
  }

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
    jstype = getObjectProperties(Number.prototype);
  } else if(mtype.indexOf('xs:boolean') > -1){
  	jstype = getObjectProperties(Boolean.prototype);
  } else if(mtype.indexOf('xs:date') > -1){
  	jstype = getObjectProperties(Date.prototype)
  } else if(mtype.indexOf('json:array') > -1){
  	jstype = getObjectProperties(Array.prototype);
  } else if(mtype.indexOf('function(*)') > -1){
  	jstype = getObjectProperties(Value.prototype);
  } else if(mtype.indexOf('empty-sequence()') > -1) {
  	jstype = null;
  } else if(mtype.indexOf('element()') > -1){
  	jstype = getObjectProperties(Element.prototype);
  } else if(mtype.indexOf('map:map') > -1){
  	jstype = getObjectProperties(Object.prototype);
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

		if(details.length > 1){
			if(namespaceMap[details[details.length-2].trim()]){

				var returnType = xdmp.functionReturnType(xdmp.function(fn.QName(namespaceMap[details[details.length-2].trim()], details[details.length-1].trim())));
				result = getReturnType(returnType).jstype;
			}
		} else {
			var props = getObjectProperties(result);
			result = (Object.keys(props.prototype).length > 0) ? props.prototype : props;
		}
		
	} 
	// else if(typeof(result) == 'object' && Object.keys(result) == 0){
	// 	result = getObjectProperties(result);
	// }


	// xdmp.log(Object.keys(result));

	response['result'] = (result) ? result : undefined;
	response['datatype'] = (result) ? getObjectProperties(result) : undefined; //(result && (typeof(result) == 'object' || typeof(result) == 'function') && Object.keys(Object.getPrototypeOf(result)).length > 0) ? Object.getPrototypeOf(result) : undefined;
} catch(e){
	response['error'] = {name: e.name, message: e.stack};
}

// xdmp.log(response);

response;