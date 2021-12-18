# Chimera 

<img src="command/frontend/res/logo.png" alt="logo" width="100"/>

Chimera is a microservices based security camera system for RTSP/IP cameras *(which kinda sorta only runs on linux)*

List of microservices: 

1. [command](command)
2. [livestream](livestream)
3. [schedule](schedule)
4. [storage](storage)
5. [gateway](gateway)
6. [memory](memory)

Massive Dependencies:
1. [motion](https://github.com/Motion-Project/motion) - should be running on same machine as [storage](storage) server for optimal performance. See [storage](storage) as for why.
2. [ffmpeg](https://ffmpeg.org) - should be installed on same machine as [livestream](livestream) and [storage](storage). 
3. [heartbeat](https://github.com/jjjpanda/heartbeat) - used to confirm server is still up.
4. [object](https://github.com/jjjpanda/object) - used to detect objects (still not implemented within start script).

## Quick Start

### 1. Install motion and ffmpeg
```
sudo apt-get install motion ffmpeg 
```
Then, set up a conf for motion with all of your cameras.
### 2. Installing NPM dependencies

If running all services on one machine:
```
npm install --no-optional
```

If splitting services, you can install each service with:
```
npm run install:<service>
```
or 
```
cd <service> && npm install
```
### 3. Create Environment Variables File

Copy the example env into an .env dotfile:
```
cp env.example .env
```

Fill in the .env with all the info listed ( for optional fields, leave blank after the "=" ). 

Then, if running any service separate run:
```
npm run validate:env && npm run validate:pass
```
This is will split the .env into multiple .env's for the respective services, then create the hash file for passwords.

If running gateway and using https run:
```
npm run validate:acme
```

### 4. Start Chimera

If running all or more than one service(s)
```
npm start
```
If splitting services
```
npm run start:<service>
```