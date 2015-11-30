#!/usr/bin/env node

var request = require('request');
var fs = require('fs');
var osenv = require('osenv');
var path = require('path');
var marklogic = require('marklogic');

var getConfig = function(){
  var configFile = path.resolve([osenv.home(), '.mlreplrc'].join('/'));
  try{
    
    if(fs.statSync(configFile).isFile()){
      return JSON.parse(fs.readFileSync(configFile));
    } else {
      return false;
    }

  } catch(e){
    return false;
  }
}

var mlconfig = getConfig()

var db = marklogic.createDatabaseClient({
  host: mlconfig.host,
  port: '8000',
  user: mlconfig.username,
  password: mlconfig.password,
  database: 'Modules',
  authType: 'DIGEST'
});

var mlauth = {user:mlconfig.username, pass:mlconfig.password, sendImmediately:false};

var buffer = [];
var upload = function(path){

  var collection = undefined;
  if(path.indexOf('docs') > -1){
    collection = path.split('/').slice(-1)[0].split('.')[0];
  }

  var docUri = (path.indexOf('ml/') > -1) ? path.substring(path.indexOf('/'), path.length) : '/'+path;

  if(path.indexOf('tar.gz') == -1){
    buffer.push({uri: docUri, content: fs.readFileSync(path), collections: (collection) ? ['docs',collection] : undefined});
  }
}


var uploadFiles = function(basedir, recursive){

  var baseStat = fs.statSync(basedir);
  if(baseStat.isFile()){
    upload(basedir);
  } else {

    var files = fs.readdirSync(basedir);
    for(var f in files){
      var path = [basedir, files[f]].join('/');
      
      var stat = fs.statSync(path)
      if(stat.isDirectory()){
        if(recursive){
          uploadFiles(path, recursive);  
        }
      } else {
          upload(path);
      }        
    }
  }
}

var batchWrite = function(buffer, batchSize){
  var bufferSize = buffer.length;
  var batches = Math.floor(bufferSize/batchSize);
  
  var batch = 0;
  while(batch <= batches){
    var batchStart = batch*batchSize;
    var batchEnd = (batch == batches) ? bufferSize : batchStart + (batchSize-1);
    // console.log(batchStart + ' :: ' + batchEnd);
    db.documents.write(buffer.slice(batchStart, batchEnd+1)).result(function(resp){console.log('uploading static content to web editor..')});
    batch++;
  }

}

uploadFiles('ml/repl.sjs');
uploadFiles('ml/util.sjs');
uploadFiles('ml/config.sjs');
uploadFiles('ml/url_rewritter.sjs');
uploadFiles('ml/requests.xqy');

uploadFiles('editor');
uploadFiles('editor/ui', true);
uploadFiles('editor/bower_components/angular/angular.min.js');
uploadFiles('editor/bower_components/angular-bootstrap/ui-bootstrap.js');
uploadFiles('editor/bower_components/angular-bootstrap/ui-bootstrap-tpls.js');
uploadFiles('editor/bower_components/ace-builds/src-min-noconflict', true);
uploadFiles('editor/bower_components/angular-ui-ace/ui-ace.min.js');
uploadFiles('editor/bower_components/bootstrap/dist', true);

uploadFiles('editor/docs', true);

// db.documents.write(buffer).result(function(resp){console.log('uploaded all static content to web editor..')});

batchWrite(buffer, 100);

request.get('http://'+mlconfig.host+':8002/manage/LATEST/servers/repl-http?group-id=Default', 
  {
    auth: mlauth,
    headers: {'Accept': 'application/json'},
    json: true
  }, 
  function(err,resp, body){
    // console.log(body)
    if(body['errorResponse']){
      console.log('configuring MLREPL server..');
      request.post('http://'+mlconfig.host+':8002/manage/LATEST/servers?group-id=Default&server-type=http', 
        {
          auth: mlauth,
          json: {
            "server-name":"repl-http", 
            "root":"/", 
            "port":mlconfig.port, 
            "content-database":mlconfig.database, 
            "modules-database":"Modules",
            "url-rewriter":"url_rewritter.sjs"
          }
        }, 
        function(err,resp, body){
          console.log('done..')
          console.log(body);    
      });

    }
});

