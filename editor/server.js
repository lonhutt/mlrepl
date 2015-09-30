var express = require('express');
var open = require('open');
var request = require('request');
var fs = require('fs');
var path = require('path');
// var mlrepl = require('../mlrepl');
var util = require('util');
var Stream = require('stream');

var app = express();

var mldbconfig = {
  database: 'Documents',
  user: 'admin',
  password: 'admin',
  completionGroups: null,
  init: function(){
    this.fetchConfig(true);
    this.fetchCompletionGroups();
  },
  eval: function(cmd, cb){
    
    var scope = this;
    request.post('http://localhost:9010/repl', 
        {
          auth: {user:this.user, pass:this.password, sendImmediately:false},
          json: {cmd:cmd, mldb:this.database},
        }, 
        function(err,resp, body){
          cb(body);
      });
    
  },
  fetchCompletionGroups: function(cb){
    request.post('http://localhost:9010/repl', 
        {
          auth: {user:this.user, pass:this.password, sendImmediately:false},
          json: {cmd:"Object.keys(getObjectProperties(this)).sort();", mldb:this.database}
        }, 
        function(err,resp, body){
          cb(body);
      });
  },
  updateDb: function(dbname){
    console.log("please wait for the server config to finished updating")
    request.put('http://localhost:8002/manage/v2/servers/repl-http/properties?group-id=Default', 
        {
          auth: {user:this.user, pass:this.password, sendImmediately:false},
          json: {'content-database':dbname},
          scope: this
        }, 
        function(err,resp, body){
          if(err){
            console.log(err);
          } else {
            this.scope.database = dbname;
            console.log(body);
          }
          
      });
  },
  fetchConfig: function(init){
    request.get('http://localhost:8002/manage/v2/servers/repl-http/properties?group-id=Default', 
        {
          auth: {user:this.user, pass:this.password, sendImmediately:false},
          json: true,
          scope: this
        }, 
        function(err,resp, body){
          if(err){
            process.domain.emit('error', "something went wrong!: " + err)
          } else {
            this.scope.database = body['content-database'];
            
            if(!init){
              request.get('http://localhost:8002/manage/LATEST/databases', 
                  {
                    headers: this.headers,
                    json: true,
                    localscope: this
                  }, 
                  function(err,resp, body){
                    var dbs = body['database-default-list']['list-items']['list-item'];
                    var dbNames = {current: null, all:[]};
                    for(var d in dbs){
                      if(dbs[d].nameref == this.localscope.scope.database){
                        dbNames.current = dbs[d].nameref;
                      }

                      dbNames.all.push(dbs[d].nameref);

                    }
                    console.log(dbNames);
                    // console.log(process);
                });

              }
            }
            
      });
  }  
};

app.use(express.static('bower_components'));
app.use(express.static('ui'));

app.use(function(req, res, next){
	req.setEncoding('utf8');
  req.body = '';
  req.on('data', function(chunk) {
    req.body += chunk;
  });
  req.on('end', function(){
    next();
  });
});

app.get('/', function(req, res){
	res.sendFile(path.join(__dirname+'/editor.html'));
});

app.post('/mlrepl', function(req, res){
	
	mldbconfig.eval(req.body, function(result){
		res.send(result);
	});
	
});

app.get('/complete', function(req, res){
	
	mldbconfig.fetchCompletionGroups(function(result){
		res.send(result);
	});
	
});

var server = app.listen(1337, function () {
  var port = server.address().port;
  console.log('Server started on port 1337.. Opening Browser');
	open('http://localhost:1337');
});