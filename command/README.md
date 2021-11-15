# Command <img src="frontend/res/logo.png" alt="logo" width="20"/> 

The command server is face of the operation. It runs the web-app and the authentication of the other endpoints. 

## ▶ /authorization

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/login|Auth Routes|N/A|N/A|
|GET|/requestLink|Auth Routes|N/A|N/A|
|GET|/verify|Auth Routes|N/A|N/A|
## ▶ /

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/res|res|N/A|N/A|
|GET|/login/:password|Attempts login with password as URL param|None|html|
|GET|/login|Serves the login page|None|html|
|GET|/|Serves main website|None|html|

## ▶ /command

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/health|Confirms server alive|N/A|N/A|