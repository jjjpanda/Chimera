# Command <img src="frontend/res/logo.png" alt="logo" width="20"/> 

The command server is face of the operation. It runs the web-app and the authentication of the other endpoints. 

Plus, the command server can proxy the [storage](../storage) and [schedule](../schedule) servers. *It's near required for full usage in the web-app.*
## ▶ /authorization

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/login|Auth Routes|N/A|N/A|
|GET|/verify|Auth Routes|N/A|N/A|
## ▶ /

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/res|res|N/A|N/A|
|GET|/|Serves main website|None|html|