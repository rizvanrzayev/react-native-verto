/**
 * react-native-verto
 * Author: Rizvan Rzayev
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * And see https://github.com/rizvanrzayev/react-native-verto for the full license details.
 */
import FSRTCPeerConnection from './FSRTCPeerConnection';
import {activateMediaNode, deactivateMediaNode, traceMediaError} from './utils';
import {mediaDevices} from 'react-native-webrtc';

let videoSourceId;

mediaDevices.enumerateDevices().then(sourceInfos => {
  for (let i = 0; i < sourceInfos.length; i++) {
    const sourceInfo = sourceInfos[i];
    if (
      sourceInfo.kind === 'videoinput' &&
      sourceInfo.facing === (true ? 'front' : 'back')
    ) {
      videoSourceId = sourceInfo.deviceId;
    }
  }
});

// function getLocalStream(isFront, callback) {
//   mediaDevices
//     .getUserMedia({
//       audio: true,
//       video: {
//         mandatory: {
//           minWidth: 500, // Provide your own width, height and frame rate here
//           minHeight: 300,
//           minFrameRate: 30,
//         },
//         facingMode: isFront ? 'user' : 'environment',
//         optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
//       },
//     })
//     .then(stream => {
//       // Got stream!
//       callback(stream);
//     })
//     .catch(logError => console.warn(logError));
// }

export default class VertoRTC {
  constructor(options = {}) {
    this.options = {
      useVideo: null,
      userData: null,
      localVideo: null,
      screenShare: false,
      useCamera: 'any',
      iceServers: false,
      videoParams: {},
      audioParams: {},
      verto: null,
      callbacks: {
        onPeerStreaming: () => {},
        onPeerStreamingError: () => {},
        onICESDP: () => {},
      },
      mediaHandlers: {
        playRemoteVideo: null,
        stopRemoteVideo: null,
        playLocalVideo: null,
        stopLocalVideo: null,
      },
      ...options,
    };

    this.mediaData = {
      SDP: null,
      profile: {},
      candidateList: [],
    };

    if (this.options.useVideo && !this.options.screenShare) {
      if (this.options.mediaHandlers.stopRemoteVideo) {
        this.options.mediaHandlers.stopRemoteVideo();
      } else {
        deactivateMediaNode(this.options.useVideo);
      }
    }
  }

  useVideo(obj, local) {
    if (obj) {
      this.options.useVideo = obj;
      this.options.localVideo = local;
    } else {
      this.options.useVideo = null;
      this.options.localVideo = null;
    }

    if (this.options.useVideo) {
      this.options.useVideo.style.display = 'none';
    }
  }

  answer(sdp, onSuccess, onError) {
    this.peer.addAnswerSDP({sdp, type: 'answer'}, onSuccess, onError);
  }

  stopPeer() {
    if (this.peer) {
      this.peer.stop();
    }
  }

  onRemoteStream(stream) {
    const {
      options: {useAudio, useVideo},
    } = this;
    const element = useVideo || useAudio;
    if (element) {
      this.options.verto.callbacks.onPlayRemoteVideo(stream);
      if (this.options.mediaHandlers.playRemoteVideo) {
        this.options.mediaHandlers.playRemoteVideo(stream);
      } else {
        activateMediaNode(element, stream);
      }
    }
  }

  stop() {
    const {
      options: {useVideo, localVideo},
      peer,
      localStream,
    } = this;

    if (useVideo) {
      if (this.options.mediaHandlers.stopRemoteVideo) {
        this.options.mediaHandlers.stopRemoteVideo();
      } else {
        deactivateMediaNode(useVideo);
      }
    }

    if (localVideo) {
      if (this.options.mediaHandlers.stopLocalVideo) {
        this.options.mediaHandlers.stopLocalVideo();
      } else {
        deactivateMediaNode(localVideo);
      }
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    if (peer) {
      peer.stop();
    }
  }

  getAudioConstraint() {
    const {useMic, audioParams, screenShare} = this.options;

    if (screenShare) {
      return false;
    }

    if (useMic === 'none') {
      return false;
    }

    if (useMic === 'any') {
      return audioParams;
    }

    return {
      ...audioParams,
      deviceId: {exact: useMic},
    };
  }

  getVideoConstraint() {
    const {videoParams, useCamera, useVideo} = this.options;

    if (!useVideo) {
      return false;
    }

    if (this.options.screenShare) {
      return this.getScreenConstraint();
    }

    if (useCamera === 'none') {
      return false;
    }

    const dimensions = {};
    const {minWidth, maxWidth} = videoParams;
    if (minWidth !== undefined && maxWidth !== undefined) {
      dimensions.width = {min: minWidth, max: maxWidth};
    }

    const {minHeight, maxHeight} = videoParams;
    if (minHeight !== undefined && maxHeight !== undefined) {
      dimensions.height = {min: minHeight, max: maxHeight};
    }

    if (useCamera === 'any') {
      return {...dimensions};
    }

    return {...dimensions, deviceId: useCamera};
  }

  getScreenConstraint() {
    const {videoParams: screenParams, useCamera: useScreen} = this.options;

    const isFirefox = !!navigator.mozGetUserMedia;
    if (isFirefox) {
      const {minWidth, maxWidth} = screenParams;
      const {minHeight, maxHeight} = screenParams;
      return {
        width: {min: minWidth, max: maxWidth},
        height: {min: minHeight, max: maxHeight},
        mediaSource: 'screen',
      };
    }

    return {
      mandatory: screenParams,
      optional: useScreen ? [{sourceId: useScreen}] : [],
    };
  }

  getMediaParams() {
    return {
      audio: this.getAudioConstraint(),
      video: this.getVideoConstraint(),
    };
  }

  onICE(candidate) {
    this.mediaData.candidate = candidate;
    this.mediaData.candidateList.push(this.mediaData.candidate);
  }

  onICESDP(sdp) {
    this.mediaData.SDP = sdp.sdp;
    this.options.callbacks.onICESDP();
  }

  createAnswer({useCamera, sdp}) {
    const {options} = this;
    const {useVideo, localVideo, iceServers} = options;

    this.type = 'answer';
    this.options.useCamera = useCamera;

    if (useVideo && localVideo) {
      const localVideoConstraints = {
        audio: {},
        video: {},
      };
      mediaDevices
        .getUserMedia(localVideoConstraints)
        .then(stream => {
          this.options.verto.callbacks.onPlayLocalVideo(stream);
          // if (this.options.mediaHandlers.playLocalVideo) {
          //   this.options.mediaHandlers.playLocalVideo(stream);
          // } else {
          //   activateMediaNode(localVideo, stream);
          // }
        })
        .catch(error => traceMediaError(localVideoConstraints, error));
    }

    const mediaConstraints = this.getMediaParams();
    if(typeof mediaConstraints.audio != 'boolean')
      mediaConstraints.audio = true;
    mediaDevices
      .getUserMedia(mediaConstraints)
      .then(stream => {
        this.peer = new FSRTCPeerConnection({
          type: 'answer',
          attachStream: stream,
          offerSDP: {sdp, type: 'offer'},
          constraints: this.getPeerConstraints(),
          onPeerStreamingError: this.options.callbacks.onPeerStreamingError,
          onICE: this.onICE.bind(this),
          onRemoteStream: this.onRemoteStream.bind(this),
          onICESDP: iceSdp => this.onICESDP(iceSdp),
          onAnswerSDP: answerSDP => {
            this.answer.SDP = answerSDP.sdp;
          },
          iceServers,
        });

        this.options.callbacks.onPeerStreaming(stream);
      })
      .catch(error => {
        traceMediaError(mediaConstraints, error);
      });
  }

  getPeerConstraints() {
    return {
      offerToReceiveAudio: this.options.useSpeak !== 'none',
      offerToReceiveVideo: !!this.options.useVideo,
    };
  }

  inviteRemotePeerConnection() {
    this.type = 'offer';

    const mediaConstraints = this.getMediaParams();
    const screen = this.options.videoParams && this.options.screenShare;
    const screenPeerConstraints = {
      offerToReceiveVideo: false,
      offerToReceiveAudio: false,
      offerToSendAudio: false,
    };

    const handleStream = stream => {
      this.localStream = stream;

      this.peer = new FSRTCPeerConnection({
        type: this.type,
        attachStream: stream,
        onICESDP: this.onICESDP.bind(this),
        onPeerStreamingError: this.options.callbacks.onPeerStreamingError,
        constraints: screen ? screenPeerConstraints : this.getPeerConstraints(),
        iceServers: this.options.iceServers,
        onICE: this.onICE.bind(this),
        onRemoteStream: remoteStream =>
          !screen && this.onRemoteStream(remoteStream),
        onOfferSDP: sdp => {
          this.mediaData.SDP = sdp.sdp;
        },
      });

      this.options.callbacks.onPeerStreaming(stream);

      if (this.options.mediaHandlers.playLocalVideo) {
        this.options.mediaHandlers.playLocalVideo(stream);
      } else {
        activateMediaNode(this.options.localVideo, stream);
      }
    };

    if (!mediaConstraints.audio && !mediaConstraints.video) {
      handleStream(null);
    } else {
      mediaDevices
        .getUserMedia(mediaConstraints)
        .then(handleStream)
        .catch(error => {
          traceMediaError(mediaConstraints, error);
        });
    }
  }
}
