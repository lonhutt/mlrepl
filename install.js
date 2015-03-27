var request = require('request');
var fs = require('fs');

fs.readFile("./repl.sjs", function(err, data){
  request.put('http://localhost:8000/LATEST/documents?database=Modules&uri=/repl.sjs', 
    {
      auth: {user:'admin', pass:'admin', sendImmediately:false},
      body: data
    }, 
    function(err,resp, body){
      console.log(body);    
  });
});

fs.readFile("./url_rewritter.sjs", function(err, data){
  request.put('http://localhost:8000/LATEST/documents?database=Modules&uri=/url_rewritter.sjs', 
    {
      auth: {user:'admin', pass:'admin', sendImmediately:false},
      body: data
    }, 
    function(err,resp, body){
      console.log(body);    
  });
});

fs.readFile("./requests.xqy", function(err, data){
  request.put('http://localhost:8000/LATEST/documents?database=Modules&uri=/requests.xqy', 
    {
      auth: {user:'admin', pass:'admin', sendImmediately:false},
      body: data
    }, 
    function(err,resp, body){
      console.log(body);    
  });
});


request.post('http://localhost:8002/manage/v2/servers?group-id=Default&server-type=http', 
  {
    auth: {user:'admin', pass:'admin', sendImmediately:false},
    json: {
      "server-name":"repl-http", 
      "root":"/", 
      "port":9010, 
      "content-database":"Documents", 
      "modules-database":"Modules",
      "url-rewriter":"url_rewritter.sjs"
    }
  }, 
  function(err,resp, body){
    console.log(body);    
});

console.log('Testing setup...')
request.post('http://localhost:9010/repl',
  {
      auth: {user:'admin', pass:'admin', sendImmediately:false},
      json: {cmd:'xdmp.databases();', mldb:'Documents'}
    },
  function(err, repl, body){
    console.log(body);
    if(!err){
      console.log('It Worked!!');
    }
  }
);