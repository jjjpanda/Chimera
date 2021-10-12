# Schedule <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

## ▶ /task

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/schedule|Schedules a request for another command server request|`{ url: String, body: JSON, cronString: String }`|`{ cronString: String, set: Boolean, destroyed: Boolean }`|
|POST|/check|Checks details of tasks|`{ url: String }`|`{ cronString: String, set: Boolean }`
|POST|/destroy|Destroys a scheduled request process|`{ url: String }`|`{ set: Boolean, destroyed: Boolean }`|