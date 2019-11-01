# Usage

## VertoParams

```javascript
const vertoParams = {
	websocket: {
		login: '<username>@<host>',
		password: '<password>',
		url: 'webSocketURL'
	},
	deviceParams: {
		useMic: 'any',
		useSpeak: 'any',
		useCamera: 'any',
	}
}
```

## Callbacks

```javascript
const callbacks = {
	onPrivateEvent: (vertoClient, dataParams, userData) => {},
	onEvent: (vertoClient, dataParams, userData) => {},
	onInfo: (params) => {},
	onClientReady: (params) => {},
	onNewCall: (call: Call) => {},
	onPlayLocalVideo: (stream: MediaStream) => {},
	onPlayRemoteVideo: (stream: MediaStream) => {},
}
```

## VertoView

```javascript
import {VertoView} from "react-native-verto";
...

const vertoParams = ...
const callbacks = ...

...
return (<VertoView vertoParams={vertoParams} callbacks={callbacks}/>);
```

<div class="alert alert-info hints-alert">
  <div class="hints-icon"><i class="fa fa-info"></i></div>
  <div class="hints-container">
    <p>Important info: this note needs to be highlighted</p>
  </div>
</div>

## VertoClient

```javascript
import {VertoClient} from 'react-native-verto';
let vertoClient = new VertoClient(vertoParams, callbacks);
```

{% hint style="info" %}
**VertoClient** using [vertoParams](usage.md#vertoparams) and [callbacks](usage.md#callbacks)
{% endhint %}

### \#makeCall

```javascript
let vertoClient = ...;

const callParams = { 
    to: '<string>', 
    from: '<string>', 
    callerName: '<string>'
};

const call = vertoClient.makeCall(callParams);
```

{% hint style="info" %}
**makeCall** returns [Call](usage.md#call) object
{% endhint %}

### \#makeVideoCall

```javascript
let vertoClient = ...;

const callParams = { 
    to: '<string>', 
    from: '<string>', 
    callerName: '<string>'
};

const call = vertoClient.makeVideoCall(callParams);
```

### \#hangup

```javascript
let vertoClient = ...;
vertoClient.hangup(callId);
```

> you can get [callId](usage.md#makecall) when you make new call

### \#purge

```javascript
let vertoClient = ...;
vertoClient.purge();
```

### \#destroy

```javascript
let vertoClient = ...;
vertoClient.destroy();
```

## Call

{% hint style="info" %}
You **must** make new [**call**](usage.md#makecall) or [**videoCall**](usage.md#makevideocall) after use.
{% endhint %}

```javascript
const call = ...;
```

### \#answer

```javascript
call.answer();
```

### \#getId

```javascript
call.getId();
```

### \#hangup

```javascript
call.hangup();
```

### \#transferTo

```javascript
const destionation = '<username>'
call.transferTo(destionation);
```

### \#hold

```javascript
call.hold();
```

### \#unhold

```javascript
call.unhold();
```

### \#toogleHold

```javascript
call.toogleHold();
```

### \#getDestinationNumber

```javascript
call.getDestinationNumber()
```

