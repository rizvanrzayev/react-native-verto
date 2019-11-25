/**
 * react-native-verto
 * Author: Rizvan Rzayev
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * And see https://github.com/rizvanrzayev/react-native-verto for the full license details.
 */

import {RTCPeerConnection, RTCSessionDescription} from 'react-native-webrtc';
import BackgroundTimer from 'react-native-background-timer';

BackgroundTimer.start();

export default class FSRTCPeerConnection {
  constructor(options) {
    this.options = options;
    const {
      constraints,
      iceServers,
      onICEComplete,
      type,
      onICESDP,
      onICE,
      onRemoteStream,
      attachStream,
      onPeerStreamingError,
      onOfferSDP,
      onAnswerSDP,
      offerSDP,
    } = options;

    const defaultIceServers = [{urls: ['stun:stun.l.google.com:19302']}];
    const peerConfig = {
      iceServers:
        typeof iceServers === 'boolean' ? defaultIceServers : iceServers,
    };
    const peer = new RTCPeerConnection(peerConfig);

    this.peer = peer;
    this.gathering = false;
    this.done = false;

    const iceHandler = () => {
      this.done = true;
      this.gathering = null;

      if (onICEComplete) {
        onICEComplete();
      }

      if (type === 'offer') {
        onICESDP(peer.localDescription);
      } else if (onICESDP) {
        onICESDP(peer.localDescription);
      }
    };

    peer.onicecandidate = event => {
      if (this.done) {
        return;
      }

      if (!this.gathering) {
        this.gathering = BackgroundTimer.setTimeout(iceHandler, 1000);
      }

      if (!event) {
        this.done = true;

        if (this.gathering) {
          clearTimeout(this.gathering);
          this.gathering = null;
        }

        iceHandler();
      } else if (event.candidate) {
        onICE(event.candidate);
      }
    };

    peer.onaddstream = event => {
      const remoteMediaStream = event.stream;

      if (onRemoteStream) {
        onRemoteStream(remoteMediaStream);
      }
    };
    peer.addStream(attachStream);

    if (onOfferSDP) {
      peer
        .createOffer(constraints)
        .then(sessionDescription => {
          peer.setLocalDescription(sessionDescription);
          onOfferSDP(sessionDescription);
        })
        .catch(onPeerStreamingError);
    }

    if (type === 'answer') {
      peer
        .setRemoteDescription(new RTCSessionDescription(offerSDP))
        .then(() => {})
        .catch(onPeerStreamingError);
      peer
        .createAnswer()
        .then(sessionDescription => {
          peer.setLocalDescription(sessionDescription);
          if (onAnswerSDP) {
            onAnswerSDP(sessionDescription);
          }
        })
        .catch(onPeerStreamingError);
    }
  }

  addAnswerSDP(sdp, cbSuccess, cbError) {
    const {onPeerStreamingError} = this.options;
    this.peer
      .setRemoteDescription(new RTCSessionDescription(sdp))
      .then(cbSuccess || (() => {}))
      .catch(cbError || onPeerStreamingError);
  }

  stop() {
    this.peer.close();
  }
}
