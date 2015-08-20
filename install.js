var request = require('request');
var fs = require('fs');

var mlauth = {user:'admin', pass:'admin', sendImmediately:false};

fs.readFile("./repl.sjs", function(err, data){
  request.put('http://localhost:8000/LATEST/documents?database=Modules&uri=/repl.sjs', 
    {
      auth: mlauth,
      body: data
    }, 
    function(err,resp, body){
      console.log(body);    
  });
});

fs.readFile("./url_rewritter.sjs", function(err, data){
  request.put('http://localhost:8000/LATEST/documents?database=Modules&uri=/url_rewritter.sjs', 
    {
      auth: mlauth,
      body: data
    }, 
    function(err,resp, body){
      console.log(body);   

  });
});

fs.readFile("./requests.xqy", function(err, data){
  request.put('http://localhost:8000/LATEST/documents?database=Modules&uri=/requests.xqy', 
    {
      auth: mlauth,
      body: data
    }, 
    function(err,resp, body){
      console.log(body);    
  });
});


request.get('http://localhost:8002/manage/LATEST/servers/repl-http?group-id=Default', 
  {
    auth: mlauth,
    headers: {
      'Accept': 'application/json'
    },
    json: true
  }, 
  function(err,resp, body){
    if(body['errorResponse']){
      
      request.post('http://localhost:8002/manage/LATEST/servers?group-id=Default&server-type=http', 
        {
          auth: mlauth,
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

    }
});

