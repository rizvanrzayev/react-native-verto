# react-native-verto

## Getting started

## Installation

#### npm:
`$ npm install react-native-verto --save`

#### yarn:
`$ yarn add react-native-verto`

### For use this library you must be link `react-native-webrtc`

React Native version < 0.60

Follow `react-native-webrtc` installation from this [link](https://github.com/react-native-webrtc/react-native-webrtc/#installation):

React Native version >= 0.60 (**auto-linking**)

#### For iOS
`cd ios/ && pod install && cd .. && react-native run-ios`

#### For Android
`react-native run-android`

## Usage

### VertoView

```javascript
import {VertoView} from 'react-native-verto';

const vertoParams = {
	websocket: {
		login: '<username>@<wsHost>',
		password: '<password>',
		url: 'webSocketURL'
	},
	deviceParams: {
		useMic: 'any',
		useSpeak: 'any',
		useCamera: 'any',
	}
}

const callbacks = {
	onPrivateEvent: (vertoClient, dataParams, userData) => {},
	onEvent: (vertoClient, dataParams, userData) => {},
	onInfo: (params) => {},
	onClientReady: (params) => {},
	onNewCall: (call: Call) => {},
	onPlayLocalVideo: (stream: MediaStream) => {},
	onPlayRemoteVideo: (stream: MediaStream) => {},
}

return(
	<VertoView vertoParams={vertoParams} callbacks={callbacks}/>
)
```

### VertoClient

```javascript
import {VertoClient} from 'react-native-verto';

const vertoParams = {
	websocket: {
		login: '<username>@<wsHost>',
		password: '<password>',
		url: 'webSocketURL'
	},
	deviceParams: {
		useMic: 'any',
		useSpeak: 'any',
		useCamera: 'any',
	}
}

const callbacks = {
	onPrivateEvent: (vertoClient, dataParams, userData) => {},
	onEvent: (vertoClient, dataParams, userData) => {},
	onInfo: (params) => {},
	onClientReady: (params) => {},
	onNewCall: (call: Call) => {},
	onPlayLocalVideo: (stream: MediaStream) => {},
	onPlayRemoteVideo: (stream: MediaStream) => {},
}

let vertoClient = new VertoClient(vertoParams, callbacks)
```

### METHODS

**destroy**
test

```javascript
vertoClient.destroy()
```

### Callbacks

* `onInfo`
* `onClientReady`
* `onNewCall`
* `onPlayLocalVideo`
* `onPlayRemoteVideo`
