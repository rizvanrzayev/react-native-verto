import React, {useEffect, useState} from 'react';
import { View } from 'react-native';
import {RTCView, MediaStream} from "react-native-webrtc";
import { VertinhoClient } from '../';
import {Params, defaultVertoCallbacks} from "../store"
import styles from './styles';

let vertoClient: VertinhoClient = null;


function VertoView({vertoParams = Params, callbacks = defaultVertoCallbacks}) {
  const [localStreamURL, setLocalStreamURL] = useState('');
  const [remoteStreamURL, setRemoteStreamURL] = useState('');

  useEffect(() => {
    vertoClient = new VertinhoClient(vertoParams, {onPlayLocalVideo, onPlayRemoteVideo, ...callbacks});
    return () => vertoClient.destroy();
  }, []);

  function onPlayLocalVideo(stream) {
    setLocalStreamURL(stream.toURL());
  }
  function onPlayRemoteVideo(stream) {
    setRemoteStreamURL(stream.toURL());
  }

  return (<View style={styles.container}>
    <View style={styles.remoteStreamContainer}>
      <RTCView streamURL={remoteStreamURL} style={styles.remoteStream} />
    </View>
    <View style={styles.localStreamContainer}>
      <RTCView streamURL={localStreamURL} style={styles.localStream} />
    </View>
  </View>)
}

export default VertoView;
