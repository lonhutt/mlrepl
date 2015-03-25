var rest =  require("/MarkLogic/appservices/utils/rest.xqy"); 
var requests =  require("requests.xqy");


var url = rest.rewrite(requests.options);

(url) ? url : xdmp.getRequestUrl();