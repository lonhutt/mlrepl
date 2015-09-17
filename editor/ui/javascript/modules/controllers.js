(function(){

  var app = angular.module('mlrepl.controllers', []);

  app.controller('EditorCtrl', ['$http', '$scope', '$location', function($http, $scope, $location){
    
  	var langTools = ace.require("ace/ext/language_tools");
		
    $scope.onEditorChange = function(editor){

    	$http.post('/mlrepl', editor[1].getValue())
    		.success(function(resp){
    			if(resp.error){
    				$scope.evalPanel.setValue(resp.error.message.split('\n')[0]);
    				return;
    			}
	    		$scope.evalPanel.setValue((resp.result) ? JSON.stringify(resp.result, null, 2) : "");
	    	})
	    	.error(function(resp){
	    		$scope.evalPanel.setValue(resp.error);
	    	});
    	

    };

    $scope.evalLoad = function(e){
    	e.$blockScrolling = Infinity;
    	$scope.evalPanel = e;
    	e.getSession().setTabSize(2)
    };

    $scope.editorLoad = function(e){
    	e.$blockScrolling = Infinity;
    	$scope.editorPanel = e;
    	e.getSession().setTabSize(2)
    }

    var mlreplCompleter = {
        getCompletions: function(editor, session, pos, prefix, callback) {
        		var line = session.getDocument().getLine(pos.row);

        		if(line.trim().length === 0 && prefix.length === 0){callback(null, []); return;}
        		else{
        			if(line.endsWith('.') || line.replace(prefix, "").endsWith('.')){
        				var context = "";
        				if(session.getDocument().getLength() > 1){
        					context = session.getDocument().getLines(0, pos.row - 1 ).join('\n');
        				}

        				if(line.indexOf('=') > 0){
        					context += '\n' + line.replace(prefix, "").substring(line.lastIndexOf('=')+1, line.length);
        				} else {
        					context += '\n'+line.replace(prefix, "");
        				}

        				$http.post('/mlrepl', context.replace(/.\s*$/, ""))
					    		.success(function(resp){
					    			if(resp.datatype || resp.result){
					    				callback(null, Object.keys((resp.datatype) ? resp.datatype : resp.result).map(function(k,v){
					    					return {name: k, value: k, score: 200, meta: "mlrepl"}
					    				}));	
					    			}
					    			
						    	})
						    	.error(function(resp){
						    		console.log(resp);
						    	});	
        			} else {
        				$http.get("/complete")
		            	.then(
		                function(resp) {
		                    if(resp.data.result){
		                    	callback(null, resp.data.result.map(function(ea) {
			                        return {name: ea, value: ea, score: 100, meta: "mlrepl"}
			                    }));	
		                    }
		                });
        			}
        		}
            
        }
    }
    langTools.addCompleter(mlreplCompleter);

  }]);

})();