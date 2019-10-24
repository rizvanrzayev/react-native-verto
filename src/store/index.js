import Call from "../verto/Call";
import {MediaStream} from "react-native-webrtc"

export const eventType = {eventData: {}}

export const Params = {
  webSocket: {
    login: '',
    password: '',
    url: ''
  },
  videoParams: {},
  audioParams: {},
  loginParams: {},
  deviceParams: {},
  userVariables: {},
  iceServers: false,
  ringSleep: 6000,
  sesssid: null,
  onmessage: (event = eventType) => {},
  onWebSocketLoginSuccess: () => {},
  onWebSocketLoginError: () => {},
  onPeerStreaming: () => {},
  onPeerStreamingError: () => {},
}

export const defaultVertoCallbacks = {
  onPrivateEvent: (vertoClient, dataParams, userData) => {},
  onEvent: (vertoClient, dataParams, userData) => {},
  onInfo: (params) => {},
  onClientReady: (params) => {},
  onNewCall: (call: Call) => {},
  onPlayLocalVideo: (stream: MediaStream) => {},
  onPlayRemoteVideo: (stream: MediaStream) => {}
}
