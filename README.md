# mlrepl
A fork of the NodeJS repl that runs evals against a MarkLogic server instead of the built-in node server.

*an important side note: You will need at least node 0.12.0 for this to work; older versions of node will be incompatible.
If you are running RHEL 6.x I strongly encourage you to follow the instructions found at https://nodejs.org/en/download/package-manager/#enterprise-linux-and-fedora to get a recent version of node on your local system.

*alternatively you can download the source from https://nodejs.org/dist/ and ./configure && make && make install from within the extracted archive.

## Setup:
```javascript
modify the .mlreplrc file in the base directory to match your system (probably just username and password)
(sudo?) npm install -g
```

## Run
```javascript
mlrepl
```

## Play with the editor
```javascript
mlrepl
```

## Special Commands
```javascript
.mldb 										--> display the current mlconfig information
.mldb list 								--> list all availible databases
.mldb database `db name` 	--> update your config to use a different database to execute against.
.mldb editor 							--> launch the editor GUI in your local browser.
```