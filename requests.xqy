(:
Copyright 2012 MarkLogic Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
:)


xquery version "1.0-ml";

module namespace requests="http://marklogic.com/repl/requests";

import module namespace rest = "http://marklogic.com/appservices/rest" at "/MarkLogic/appservices/utils/rest.xqy";

declare option xdmp:mapping "false";

declare variable $requests:options as element(rest:options) :=
  <rest:options>
	(:: if a user goes to the root url path, redirect to 'heatmap' ::)
    <rest:request uri="^/$" endpoint="/redirect.xqy">
      <rest:uri-param name="__ml_redirect__">/repl</rest:uri-param>
    </rest:request>
	
    <rest:request uri="^/repl/?$" endpoint="repl.sjs" user-params="allow">
  		<rest:http method="GET POST"/>
      <rest:param name="db" as="string" match="(.+)">$1</rest:param>
    </rest:request>

    <rest:request uri="^/watch/?$" endpoint="watch.sjs" user-params="allow">
      <rest:http method="POST"/>
    </rest:request>	

  </rest:options>;