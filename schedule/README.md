# Schedule <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

The scheduler is pretty self explanatory. You need a task scheduled? Done.

## ▶ /task

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/schedule|Schedules a request for another command server request|`{ url: String, body: JSON, cronString: String }`|`{ cronString: String, set: Boolean, destroyed: Boolean }`|
|POST|/check|Checks details of tasks|`{ url: String }`|`{ cronString: String, set: Boolean }`
|POST|/destroy|Destroys a scheduled request process|`{ url: String }`|`{ set: Boolean, destroyed: Boolean }`|

⚠️⚠️⚠️ Under Construction ⚠️⚠️⚠️
|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/create|Schedules a request for another command server request|`{ url: String, body: JSON, cronString: String }`|`{ cronString: String, set: Boolean, destroyed: Boolean }`|
|POST|/list|Checks details of tasks|`{ url: String }`|`{ cronString: String, set: Boolean }`|
|POST|/stop|Destroys a scheduled request process|`{ url: String }`|`{ set: Boolean, destroyed: Boolean }`|
|POST|/delete|Destroys a scheduled request process|`{ url: String }`|`{ set: Boolean, destroyed: Boolean }`|

```javascript
// id = task-[RandomAlphaNumeric]

//TaskObj
{
    id: String, // id
    url: String,
    body: Object,
    cookies: String,
    cronString: String,
    running: Boolean,
    task: Object //node-cron object
}
```

## ▶ /schedule

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/health|Confirms server alive|N/A|N/A|