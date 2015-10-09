xquery version "1.0-ml";

module namespace requests="http://marklogic.com/repl/requests";

import module namespace rest = "http://marklogic.com/appservices/rest" at "/MarkLogic/appservices/utils/rest.xqy";

declare option xdmp:mapping "false";

declare variable $requests:options as element(rest:options) :=
  <rest:options>
    <rest:request uri="^/$" endpoint="/redirect.xqy">
      <rest:uri-param name="__ml_redirect__">/repl</rest:uri-param>
    </rest:request>
	
    <rest:request uri="^/repl/?$" endpoint="repl.sjs" user-params="allow">
  		<rest:http method="GET POST"/>
    </rest:request>

    <rest:request uri="^/editor/?$" endpoint="/editor/editor.html" user-params="allow">
      <rest:http method="GET"/>
    </rest:request>

    <rest:request uri="^/complete/?$" endpoint="/editor/editor.html" user-params="allow">
      <rest:http method="GET"/>
    </rest:request>

    <rest:request uri="^/config/?$" endpoint="/config.sjs" user-params="allow">
      <rest:http method="GET POST"/>
    </rest:request>

  </rest:options>;