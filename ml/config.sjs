var admin =  require("/MarkLogic/admin.xqy");

if(xdmp.getRequestMethod() == "POST"){

	var params = JSON.parse(xdmp.getRequestBody().toString());
	if(params.dbId){
		try{
			var config = admin.getConfiguration();
			var groupId = admin.groupGetId(config, "Default");
			var newConfig = admin.appserverSetDatabase(config, admin.appserverGetId(config, groupId, "repl-http"), xdmp.database(params.dbId));

			admin.saveConfigurationWithoutRestart(newConfig);
		} catch(e){
			e;
		}
	}

} else {

	var config = {databases:[], server:{}};

	var serverId = xdmp.server('repl-http');
	var dbIds = xdmp.databases().toArray();

	for(var i in dbIds){
	  config.databases.push({name:xdmp.databaseName(dbIds[i]).toString(), id: dbIds[i]});
	}

	config.server.contentDb = {name: xdmp.databaseName(xdmp.database()), id: xdmp.database()};

  config.databases = config.databases.sort(function(a,b){return (a.name > b.name) - (a.name < b.name)});

	config;

}