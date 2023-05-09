/**
 * react-native-verto
 * Author: Rizvan Rzayev
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * And see https://github.com/rizvanrzayev/react-native-verto for the full license details.
 */
import Call from './Call';
import ConferenceManager from '../conference/ConferenceManager';
import ConferenceLiveArray from '../conference/ConferenceLiveArray';
import {printError, printWarning} from '../common/utils';
import {generateGUID, ENUM} from './utils';
import {Params, defaultVertoCallbacks, eventType} from '../store';
import BackgroundTimer from 'react-native-background-timer';

BackgroundTimer.start();
let sessionIDCache;

export default class VertinhoClient {
  constructor(params = Params, vertoCallbacks = defaultVertoCallbacks, conferenceCallbacks = {}) {
    this.params = {...params};

    const defaultCallback = x => x;
    this.callbacks = {
      onClientReady: defaultCallback,
      onClientClose: defaultCallback,
      onConferenceReady: defaultCallback,
      onConferenceDisabled: defaultCallback,
      onInfo: defaultCallback,
      onDisplay: defaultCallback,
      onCallStateChange: defaultCallback,
      onPrivateEvent: defaultCallback,
      onStreamReady: defaultCallback,
      onNewCall: defaultCallback,
      ...vertoCallbacks,
    };
    this.conferenceCallbacks = {
      onReady: defaultCallback,
      onDestroyed: defaultCallback,
      onBootstrappedMembers: defaultCallback,
      onAddedMember: defaultCallback,
      onModifiedMember: defaultCallback,
      onRemovedMember: defaultCallback,
      onChatMessage: defaultCallback,
      onInfo: defaultCallback,
      onModeration: defaultCallback,
      ...conferenceCallbacks,
    };

    this.webSocket = null;
    this.webSocketCallbacks = {};
    this.retryingTimer = null;
    this.currentWebSocketRequestId = 0;
    this.options = {};
    this.calls = {};
    this.conference = null;

    this.connect();
  }

  connect() {
    this.options = {
      webSocket: {
        login: '',
        password: '',
        url: '',
      },
      videoParams: {},
      audioParams: {},
      loginParams: {},
      deviceParams: {},
      userVariables: {},
      iceServers: false,
      ringSleep: 6000,
      sessid: null,
      onmessage: event => this.handleMessage(event.eventData),
      onWebSocketLoginSuccess: () => {},
      onWebSocketLoginError: error =>
        printError('Error reported by WebSocket login', error),
      onPeerStreaming: () => {},
      onPeerStreamingError: () => {},
      ...this.params,
      ...this.callbacks,
    };

    if (!this.options.deviceParams.useMic) {
      this.options.deviceParams.useMic = 'any';
    }

    if (!this.options.deviceParams.useSpeak) {
      this.options.deviceParams.useSpeak = 'any';
    }

    if (!this.options.blockSessionRecovery) {
      if (this.options.sessid) {
        this.sessid = this.options.sessid;
      } else {
        this.sessid = sessionIDCache || generateGUID();
        sessionIDCache = this.sessid;
      }
    } else {
      this.sessid = generateGUID();
    }

    this.calls = {};
    this.callbacks = this.callbacks || {};
    this.webSocketSubscriptions = {};
    this.connectSocket();
  }

  connectSocket() {
    if (this.retryingTimer) {
      clearTimeout(this.retryingTimer);
    }

    if (this.socketReady()) {
      printWarning('Tried to connect to socket but already had a ready one');
      return;
    }

    this.authing = false;

    if (this.webSocket) {
      delete this.webSocket;
    }

    this.webSocket = new WebSocket(this.options.webSocket.url);

    this.webSocket.onmessage = this.onWebSocketMessage.bind(this);

    this.webSocket.onclose = () => {
      printWarning('WebSocket closed, attempting to connect again in 5s.');
      this.callbacks.onClientClose();
      this.retryingTimer = BackgroundTimer.setTimeout(() => {
        if(this.webSocket != null)
          this.connectSocket();
      }, 5000);      
    };

    this.webSocket.onopen = () => {
      if (this.retryingTimer) {
        printWarning('Successfully WebSocket attempt to reconnect.');
        clearTimeout(this.retryingTimer);
      }

      this.publish('login', {});
    };
  }

  socketReady() {
    if (this.webSocket === null || this.webSocket.readyState > 1) {
      return false;
    }

    return true;
  }

  purge() {
    Object.keys(this.calls).forEach(callId => {
      this.calls[callId].setState(ENUM.state.purge);
    });

    this.webSocketSubscriptions = {};
  }

  publish(method, params = {}, onSuccess = x => x, onError = x => x) {
    this.currentWebSocketRequestId += 1;
    const request = {
      jsonrpc: '2.0',
      method,
      params: {sessid: this.sessid, ...params},
      id: this.currentWebSocketRequestId,
    };
    const requestStringified = JSON.stringify(request);

    if ('id' in request && onSuccess !== undefined) {
      this.webSocketCallbacks[request.id] = {
        requestStringified,
        request,
        onSuccess,
        onError,
      };
    }

    if(this.webSocket != null)
      this.webSocket.send(requestStringified);
  }

  handleJSONRPCMessage(message) {
    if (message.result) {
      const {onSuccess} = this.webSocketCallbacks[message.id];
      delete this.webSocketCallbacks[message.id];
      onSuccess(message.result, this);
      return;
    }

    if (!message.error) {
      return;
    }

    if (!this.authing && parseInt(message.error.code, 10) === -32000) {
      this.authing = true;

      this.publish(
        'login',
        {
          login: this.options.webSocket.login,
          passwd: this.options.webSocket.password,
          loginParams: this.options.loginParams,
          userVariables: this.options.userVariables,
        },
        () => {
          this.authing = false;
          delete this.webSocketCallbacks[message.id];
          this.options.onWebSocketLoginSuccess();
        },
        () => {
          delete this.webSocketCallbacks[message.id];
          this.options.onWebSocketLoginError(message.error);
        },
      );
      return;
    }

    const {onError} = this.webSocketCallbacks[message.id];
    delete this.webSocketCallbacks[message.id];
    onError(message.error, this);
  }

  onWebSocketMessage(event) {
    const message = JSON.parse(event.data);

    if (
      message &&
      message.jsonrpc === '2.0' &&
      this.webSocketCallbacks[message.id]
    ) {
      this.handleJSONRPCMessage(message);
      return;
    }

    if (typeof this.options.onmessage !== 'function') {
      return;
    }

    const fixedEvent = {...event, eventData: message || {}};
    const reply = this.options.onmessage(fixedEvent);

    if (
      typeof reply !== 'object' ||
      !fixedEvent.eventData.id ||
      !this.webSocket
    ) {
      return;
    }

    if(this.webSocket != null){
      this.webSocket.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: fixedEvent.eventData.id,
          result: reply,
        }),
      );
    }
  }

  handleMessage(data) {
    if (!data || !data.method || !data.params) {
      printError('Invalid WebSocket message', data);
      return;
    }

    if (data.params.eventType === 'channelPvtData') {
      this.handleChannelPrivateDataMessage(data);
    } else if (data.params.callID) {
      this.handleMessageForCall(data);
    } else {
      this.handleMessageForClient(data);
    }
  }

  handleChannelPrivateDataMessage(data) {
    const {params: event} = data;
    const existingConference = this.conference && {...this.conference};
    if (event.pvtData.action === 'conference-liveArray-join') {
      if (existingConference) {
        printWarning(
          'Ignoring doubled private event of live array join',
          event,
        );
        return;
      }

      const conference = {
        creationEvent: event,
        privateEventChannel: event.eventChannel,
        memberId: event.pvtData.conferenceMemberID,
        role: event.pvtData.role,
        manager: new ConferenceManager(this, {
          chat: {
            channel: event.pvtData.chatChannel,
            handler: this.conferenceCallbacks.onChatMessage,
          },
          info: {
            channel: event.pvtData.infoChannel,
            handler: this.conferenceCallbacks.onInfo,
          },
          moderation: event.pvtData.modChannel
            ? null
            : {
                channel: event.pvtData.modChannel,
                handler: this.conferenceCallbacks.onModeration,
              },
        }),
        liveArray: new ConferenceLiveArray(
          this,
          event.pvtData.laChannel,
          event.pvtData.laName,
          {
            onBootstrappedMembers: this.conferenceCallbacks
              .onBootstrappedMembers,
            onAddedMember: this.conferenceCallbacks.onAddedMember,
            onModifiedMember: this.conferenceCallbacks.onModifiedMember,
            onRemovedMember: this.conferenceCallbacks.onRemovedMember,
          },
        ),
      };
      this.conference = conference;
      this.conferenceCallbacks.onReady(conference);
    } else if (event.pvtData.action === 'conference-liveArray-part') {
      if (!existingConference) {
        printWarning(
          'Ignoring event of live array part without conference instance',
          event,
        );
        return;
      }

      existingConference.manager.destroy();
      existingConference.liveArray.destroy();

      this.conference = null;

      this.conferenceCallbacks.onDestroyed(existingConference);
    } else {
      printWarning('Not implemented private data message', data);
    }
  }

  handleMessageForClient(data) {
    const channel = data.params.eventChannel;
    const subscription = channel && this.webSocketSubscriptions[channel];

    switch (data.method) {
      case 'verto.punt':
        this.destroy();
        break;
      case 'verto.event':
        if (!subscription && channel === this.sessid) {
          this.callbacks.onPrivateEvent(data.params);
        } else if (!subscription && channel && this.calls[channel]) {
          this.callbacks.onPrivateEvent(data.params);
        } else if (!subscription) {
          printWarning(
            'Ignoring event for unsubscribed channel',
            channel,
            data.params,
          );
        } else if (!subscription || !subscription.ready) {
          printError(
            'Ignoring event for a not ready channel',
            channel,
            data.params,
          );
        } else if (subscription.handler) {
          subscription.handler(data.params, subscription.userData);
        } else if (this.callbacks.onEvent) {
          this.callbacks.onEvent(this, data.params, subscription.userData);
        } else {
          printWarning('Ignoring event without callback', channel, data.params);
        }
        break;
      case 'verto.info':
        this.callbacks.onInfo(data.params);
        break;
      case 'verto.clientReady':
        this.callbacks.onClientReady(data.params);
        break;
      default:
        printWarning('Ignoring invalid method with no call id', data.method);
        break;
    }
  }

  handleMessageForCall(data) {
    const existingCall = this.calls[data.params.callID];
   
    if (data.method === "verto.attach" && existingCall) {
      delete this.calls[data.params.callID];
      existingCall.rtc.stop();
    }

    if (this.calls[data.params.callID]) {
      switch (data.method) {
        case 'verto.bye':
          existingCall.hangup(data.params);
          break;
        case 'verto.answer':
          existingCall.handleAnswer(data.params.sdp);
          break;
        case 'verto.media':
          existingCall.handleMedia(data.params.sdp);
          break;
        case 'verto.display':
          existingCall.handleDisplay(
            data.params.display_name,
            data.params.display_number,
          );
          break;
        case 'verto.info':
          existingCall.handleInfo(data.params);
          break;
        default:
          printWarning(
            'Ignoring existing call event with invalid method',
            data.method,
          );
          break;
      }
    } else if (
      data.method === 'verto.attach' ||
      data.method === 'verto.invite'
    ) {
      const useVideo = data.params.sdp && data.params.sdp.indexOf('m=video') > 0;
      const useStereo = data.params.sdp && data.params.sdp.indexOf('stereo=1') > 0;
      if (data.method === 'verto.attach') {
        const newCall = new Call(ENUM.direction.inbound, this, {
          ...data.params,
          attach: true,
          useVideo,
          useStereo
        });
        printWarning('handleMessageForCall set recovering')
        newCall.setState(ENUM.state.recovering);
        //this.callbacks.onRecoveryCall(newCall);
      }else{
        const newCall = new Call(ENUM.direction.inbound, this, {
          ...data.params,
          attach: false,
          useVideo,
          useStereo
        });
        this.callbacks.onNewCall(newCall);
      }
    } else {
      printWarning('Ignoring call event with invalid method', data.method);
    }
  }

  processReply(method, {subscribedChannels, unauthorizedChannels}) {
    if (method !== 'verto.subscribe') {
      return;
    }

    Object.keys(subscribedChannels || {}).forEach(channelKey => {
      const channel = subscribedChannels[channelKey];
      this.setReadySubscription(channel);
    });

    Object.keys(unauthorizedChannels || {}).forEach(channelKey => {
      const channel = unauthorizedChannels[channelKey];
      printError('Unauthorized', channel);
      this.setDroppedSubscription(channel);
    });
  }

  setDroppedSubscription(channel) {
    delete this.webSocketSubscriptions[channel];
  }

  setReadySubscription(channel) {
    const subscription = this.webSocketSubscriptions[channel];
    if (subscription) {
      subscription.ready = true;
    }
  }

  broadcastMethod(method, params) {
    const reply = event => this.processReply(method, event);
    this.publish(method, params, reply, reply);
  }

  broadcast(eventChannel, data) {
    this.broadcastMethod('verto.broadcast', {eventChannel, data});
  }

  subscribe(eventChannel, params = {}) {
    const eventSubscription = {
      eventChannel,
      handler: params.handler,
      userData: params.userData,
      ready: false,
    };

    if (this.webSocketSubscriptions[eventChannel]) {
      printWarning('Overwriting an already subscribed channel', eventChannel);
    }

    this.webSocketSubscriptions[eventChannel] = eventSubscription;
    this.broadcastMethod('verto.subscribe', {eventChannel});
    return eventSubscription;
  }

  unsubscribe(eventChannel) {
    delete this.webSocketSubscriptions[eventChannel];
    this.broadcastMethod('verto.unsubscribe', {eventChannel});
  }

  makeVideoCall({callerName, ...params}, mediaHandlers = {}) {
    if (!callerName) {
      printError('No `callerName` parameter on making video call.');
    }

    return this.makeCall(
      {callerName, useVideo: true, ...params},
      mediaHandlers,
    );
  }

  makeCall({to, from, ...otherParams}, mediaHandlers = {}) {
    if (!to || !from) {
      printError('No `to` or `from` parameters on making call.');
      return null;
    }

    const {callerName = 'Vertinho', ...params} = otherParams;
    params.destination_number = to;
    params.caller_id_number = from;
    params.caller_id_name = callerName;

    if (!this.socketReady()) {
      printError('Socket not ready.');
      return null;
    }

    const call = new Call(ENUM.direction.outbound, this, params, mediaHandlers);
    call.rtc.inviteRemotePeerConnection();
    return call;
  }

  destroy() {
    if (this.retryingTimer)
      clearTimeout(this.retryingTimer);
    if (this.socketReady()) {
      this.webSocket.close();
      this.purge();
    } else {
      printError('Tried to close a not ready socket while destroying.');
    }

    if (this.webSocket)
      delete this.webSocket;
    this.webSocket = null;
  }

  hangup(callId) {
    if (callId) {
      const call = this.calls[callId];

      if (call) {
        call.hangup();
      } else {
        printError('Error on hanging up call', callId);
      }

      return;
    }

    Object.keys(this.calls).forEach(id => {
      this.calls[id].hangup();
    });
  }
}
