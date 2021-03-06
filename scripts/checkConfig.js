var fs = require('fs');
var osenv = require('osenv');
var path = require('path');
var readline = require('readline');

var configFile = path.resolve([osenv.home(), '.mlreplrc'].join('/'));

var getConfig = function(){
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

var buildConfig = function(){

  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  var configObj = {
    username: 'admin',
    password: 'admin',
    host: 'localhost',
    port: 9010,
    database: 'Documents'
  };

  rl.question('ML Username ['+configObj.username+']: ', function(resp){
    if(resp.trim().length > 0){
      configObj.username = resp.trim();
    }

    rl.question('ML Password ['+configObj.password+']: ', function(resp){
      if(resp.trim().length > 0){
        configObj.password = resp.trim();
      }
      rl.question('ML hostname ['+configObj.host+']: ', function(resp){
        if(resp.trim().length > 0){
          configObj.host = resp.trim();
        }
        rl.question('ML port number ['+configObj.port+']: ', function(resp){
          if(resp.trim().length > 0){
            configObj.port = parseInt(resp.trim());
          }

          rl.question('ML Database name ['+configObj.database+']: ', function(resp){
            if(resp.trim().length > 0){
              configObj.database = resp.trim();
            }

            fs.writeFileSync(configFile, JSON.stringify(configObj, null, 2))

            rl.close();

          });
        });
      });
    });
  });  
}

if(!getConfig()){
  buildConfig();  
} else {
  console.log("You already have a vaild .mlreplrc file in your home directory");
}
