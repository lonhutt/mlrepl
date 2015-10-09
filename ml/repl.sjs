// var global = {};

var util = require('util.sjs');

var params = JSON.parse(xdmp.getRequestBody().toString());

// var db = (params.mldb) ? params.mldb : "Documents";

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

  var props = {};

  if(util.isArray(obj)){
    props = Object.getOwnPropertyNames(Array.prototype);
  } else if(util.isBoolean(obj)){
    props = Object.getOwnPropertyNames(Boolean.prototype);
  } else if(util.isDate(obj)){
    props = Object.getOwnPropertyNames(Date.prototype);
  } else if(util.isNumber(obj)){
    props = Object.getOwnPropertyNames(Number.prototype);
  } else if(util.isString(obj)){
    props = Object.getOwnPropertyNames(String.prototype);
  } else if(util.isRegExp(obj)){
    props = Object.getOwnPropertyNames(RegExp.prototype);
  } else if(Object.getOwnPropertyNames(obj).length === 0){


    props = Object.getOwnPropertyNames(obj.constructor.prototype);

    // xdmp.log(Object.keys(obj.constructor.prototype));
    props = props.concat(Object.keys(obj.constructor.prototype));
    // for(var p in Object.keys(obj.constructor.prototype)){
    //   props.push(p);
    // }


  } else {
    props = Object.getOwnPropertyNames(obj)
  }

  var result = {}
  for(var i in props){
    result[props[i]] = (obj[props[i]]) ? obj[props[i]] : null;
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

var getDocs = function(fname, lib){

  var doc = {name: [lib,fname].join('.'), summary: undefined, examples: undefined};

  var xqy = "declare namespace api='http://marklogic.com/rundmc/api';declare namespace html='http://www.w3.org/1999/xhtml';fn:collection('"+lib+"')//api:function[@name='"+fname+"']";

  var docXqySummary = xdmp.xqueryEval(xqy+"/api:summary//text()", null, {database: xdmp.database("Modules")});
  var docXqyExamples = xdmp.xqueryEval(xqy+"/api:example[@class='javascript']/html:pre/text()", null, {database: xdmp.database("Modules")});

  doc.summary = docXqySummary.toString();
  doc.examples = docXqyExamples.toArray();

  return doc;

}

var response = {result:undefined, datatype:undefined, error:undefined, doc: undefined};
try{
	var result = eval(params.cmd);

	if(util.isFunction(result)){
		var details = params.cmd.split("\n").slice(-1)[0].split('.');
    if(details.length > 1){
			if(namespaceMap[details[details.length-2].trim()]){

				// xdmp.log(getDocs(details[details.length-1].trim(),details[details.length-2].trim()));
        var returnType = xdmp.functionReturnType(xdmp.function(fn.QName(namespaceMap[details[details.length-2].trim()], details[details.length-1].trim())));
				result = getReturnType(returnType).jstype;
        response.doc = getDocs(details[details.length-1].trim(), details[details.length-2].trim());
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