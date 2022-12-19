/**
 * react-native-verto
 * Author: Rizvan Rzayev
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * And see https://github.com/rizvanrzayev/react-native-verto for the full license details.
 */
import VertoRTC from '../webrtc/VertoRTC';
import {printError, printWarning} from '../common/utils';
import {generateGUID, ENUM} from './utils';
import {Clipboard} from 'react-native';
import BackgroundTimer from 'react-native-background-timer';

BackgroundTimer.start();

export default class Call {
  constructor(direction, verto, params, mediaHandlers = {}) {
    this.direction = direction;
    this.verto = verto;
    this.params = {
      //callID: generateGUID(),
      useVideo: verto.options.useVideo,
      useStereo: verto.options.useStereo,
      screenShare: false,
      useCamera: false,
      useMic: verto.options.deviceParams.useMic,
      useSpeak: verto.options.deviceParams.useSpeak,
      remoteVideo: verto.options.remoteVideo,
      remoteAudioId: verto.options.remoteAudioId,
      localVideo: verto.options.localVideo,
      login: verto.options.login,
      videoParams: verto.options.videoParams,
      ...params,
    };
    this.mediaHandlers = mediaHandlers;

    if (!this.params.screenShare) {
      this.params.useCamera = verto.options.deviceParams.useCamera;
    }

    this.answered = false;

    this.lastState = ENUM.state.new;
    this.state = this.lastState;
    
    if(this.params.callID === undefined)
      this.params.callID = generateGUID();

    this.verto.calls[this.params.callID] = this;

    if (this.direction === ENUM.direction.inbound) {
      if (this.params.display_direction === 'outbound') {
        this.params.remote_caller_id_name =
          this.params.caller_id_name || 'NOBODY';
        this.params.remote_caller_id_number =
          this.params.caller_id_number || 'UNKNOWN';
      } else {
        this.params.remote_caller_id_name =
          this.params.callee_id_name || 'NOBODY';
        this.params.remote_caller_id_number =
          this.params.callee_id_number || 'UNKNOWN';
      }
    } else {
      this.params.remote_caller_id_name = 'OUTBOUND CALL';
      this.params.remote_caller_id_number = this.params.destination_number;
    }

    this.bootstrapRealtimeConnection();

    if (this.direction === ENUM.direction.inbound) {
      if (this.params.attach) {
        this.answer();
      } else {
        this.ring();
      }
    }
  }

  bootstrapRealtimeConnection() {
    const callbacks = {
      onICESDP: () => {
        const {requesting, answering, active} = ENUM.state;

        if ([requesting, answering, active].includes(this.state)) {
          printError(
            'This ICE SDP should not being received, reload your page!',
          );
          return;
        }

        let firstTime = true;
        let newsdp = this.rtc.mediaData.SDP.split('\r\n');
        newsdp = newsdp.map((line, index) => {
          if (line && line.indexOf('a=rtcp:9 IN IP4 0.0.0.0') === 0) {
            if (firstTime) {
              const audioCandidates = this.rtc.mediaData.candidateList
                .filter(val => val.sdpMid === 'audio')
                .map(val => `a=${val.candidate}`);
              // audioCandidates.unshift(line);
              newsdp.splice(
                index + 1,
                0,
                audioCandidates[0],
                audioCandidates[1],
                audioCandidates[2],
                audioCandidates[3],
                audioCandidates[4],
                audioCandidates[5],
                audioCandidates[6],
              );
            } else {
              const videoCandidates = this.rtc.mediaData.candidateList
                .filter(val => val.sdpMid === 'video')
                .map(val => `a=${val.candidate}`);
              // videoCandidates.unshift(line);
              newsdp.splice(
                index + 1,
                0,
                videoCandidates[0],
                videoCandidates[1],
                videoCandidates[2],
                videoCandidates[3],
                videoCandidates[4],
                videoCandidates[5],
                videoCandidates[6],
              );
            }
            firstTime = false;
          }
          return line;
        });

        const isActivelyCalling = this.rtc.type === 'offer';
        const options = {sdp: newsdp.join('\r\n')};
        if (isActivelyCalling) {
          if (this.state === active) {
            this.setState(requesting);
            this.broadcastMethod('verto.attach', options);
          } else {
            this.setState(requesting);
            this.broadcastMethod('verto.invite', options);
          }
        } else {
          this.setState(answering);
          this.broadcastMethod(
            this.params.attach ? 'verto.attach' : 'verto.answer',
            options,
          );
        }
      },
      onPeerStreaming: stream => {
        this.verto.options.onPeerStreaming(stream);
      },
      onPeerStreamingError: error => {
        this.verto.options.onPeerStreamingError(error);
        this.hangup({cause: 'Device or Permission Error'});
      },
    };

    this.rtc = new VertoRTC({
      callbacks,
      mediaHandlers: this.mediaHandlers,
      localVideo: this.params.screenShare ? null : this.params.localVideo,
      useVideo: this.params.remoteVideo,
      useAudio: this.params.remoteAudioId,
      videoParams: this.params.videoParams || {},
      audioParams: this.verto.options.audioParams || {},
      iceServers: this.verto.options.iceServers,
      screenShare: this.params.screenShare,
      useCamera: this.params.useCamera,
      useMic: this.params.useMic,
      useSpeak: this.params.useSpeak,
      verto: this.verto,
    });
  }

  broadcastMethod(method, options) {
    const {noDialogParams, ...methodParams} = options;

    const dialogParams = Object.keys(this.params).reduce(
      (accumulator, currentKey) => {
        if (
          currentKey === 'sdp' &&
          method !== 'verto.invite' &&
          method !== 'verto.attach'
        ) {
          return accumulator;
        }

        if (currentKey === 'callID' && noDialogParams === true) {
          return accumulator;
        }

        return {...accumulator, [currentKey]: this.params[currentKey]};
      },
      {},
    );

    const handleMethodResponseFn = success => x =>
      this.handleMethodResponse(method, success, x);
    this.verto.publish(
      method,
      {
        ...methodParams,
        dialogParams,
      },
      handleMethodResponseFn(true),
      handleMethodResponseFn(false),
    );
  }

  setState(state) {
    if (this.state === ENUM.state.ringing) {
      this.stopRinging();
    }

    const checkStateChange =
      state === ENUM.state.purge || ENUM.states[this.state.name][state.name];
    if (this.state === state || !checkStateChange) {
      printError(
        `Invalid call state change from ${this.state.name} to ${
          state.name
        }. ${this}`,
      );
      this.hangup();
      return false;
    }

    this.lastState = this.state;
    this.state = state;

    this.verto.callbacks.onCallStateChange({
      previous: this.lastState,
      current: this.state,
      callID: this.params.callID
    });

    const speaker = this.params.useSpeak;
    const useCustomSpeaker = speaker && speaker !== 'any' && speaker !== 'none';
    const isAfterRequesting = this.lastState.val > ENUM.state.requesting.val;
    const isBeforeHangup = this.lastState.val < ENUM.state.hangup.val;

    switch (this.state) {
      case ENUM.state.early:
      case ENUM.state.active:
        if (useCustomSpeaker) {
          printWarning('Custom speaker not supported, ignoring.');
        }
        break;

      case ENUM.state.trying:
        // setTimeout(() => {
        //   if (this.state === ENUM.state.trying) {
        //     printWarning(`Turning off after 3s of trying. ${this}`);
        //     this.setState(ENUM.state.hangup);
        //   }
        // }, 3000);
        break;

      case ENUM.state.purge:
        this.setState(ENUM.state.destroy);
        break;

      case ENUM.state.hangup:
        if (isAfterRequesting && isBeforeHangup) {
          this.broadcastMethod('verto.bye', {});
        }

        this.setState(ENUM.state.destroy);
        break;

      case ENUM.state.destroy:
        delete this.verto.calls[this.params.callID];
        if (this.params.screenShare) {
          this.rtc.stopPeer();
        } else {
          this.rtc.stop();
        }
        break;

      default:
        break;
    }

    return true;
  }

  handleMethodResponse(method, success, response) {
    switch (method) {
      case 'verto.answer':
      case 'verto.attach':
        if (success) {
          this.setState(ENUM.state.active);
        } else {
          this.hangup();
        }
        break;

      case 'verto.invite':
        if (success) {
          this.setState(ENUM.state.trying);
        } else {
          this.setState(ENUM.state.destroy);
        }
        break;

      case 'verto.bye':
        this.hangup();
        break;

      case 'verto.modify':
        if (response.holdState === 'held' && this.state !== ENUM.state.held) {
          this.setState(ENUM.state.held);
        }

        if (
          response.holdState === 'active' &&
          this.state !== ENUM.state.active
        ) {
          this.setState(ENUM.state.active);
        }
        break;

      default:
        break;
    }
  }

  hangup(params) {
    if (params) {
      this.causeCode = params.causeCode;
      this.cause = params.cause;
    }

    if (!this.cause && !this.causeCode) {
      this.cause = 'NORMAL_CLEARING';
    }

    const isNotNew = this.state.val >= ENUM.state.new.val;
    const didntHangupYet = this.state.val < ENUM.state.hangup.val;
    if (isNotNew && didntHangupYet) {
      this.setState(ENUM.state.hangup);
    }

    const didntDestroyYet = this.state.val < ENUM.state.destroy;
    if (didntDestroyYet) {
      this.setState(ENUM.state.destroy);
    }
  }

  stopRinging() {
    if (!this.verto.ringer) {
      return;
    }

    this.verto.ringer.getTracks().forEach(ringer => ringer.stop());
  }

  indicateRing() {
    if (!this.verto.ringer) {
      printWarning(`Call is ringing, but no ringer set. ${this}`);
      return;
    }

    if (!this.verto.ringer.src && this.verto.options.ringFile) {
      this.verto.ringer.src = this.verto.options.ringFile;
    }

    this.verto.ringer.play();

    BackgroundTimer.setTimeout(() => {
      this.stopRinging();
      if (this.state === ENUM.state.ringing) {
        this.indicateRing();
      } else {
        printWarning(`Call stopped ringing, but no ringer set. ${this}`);
      }
    }, this.verto.options.ringSleep);
  }

  ring() {
    this.setState(ENUM.state.ringing);
    this.indicateRing();
  }

  sendTouchtone(digit) {
    this.broadcastMethod('verto.info', {dtmf: digit});
  }

  sendRealTimeText({code, chars}) {
    this.broadcastMethod('verto.info', {
      txt: {code, chars},
      noDialogParams: true,
    });
  }

  transferTo(destination) {
    this.broadcastMethod('verto.modify', {action: 'transfer', destination});
  }

  hold() {
    this.broadcastMethod('verto.modify', {action: 'hold'});
  }

  unhold() {
    this.broadcastMethod('verto.modify', {action: 'unhold'});
  }

  toggleHold() {
    this.broadcastMethod('verto.modify', {action: 'toggleHold'});
  }

  sendMessageTo(to, body) {
    this.broadcastMethod('verto.info', {
      msg: {from: this.params.login, to, body},
    });
  }

  answer() {
    if (this.answered) {
      return;
    }

    this.rtc.createAnswer(this.params);
    this.answered = true;
  }

  handleAnswer(sdp) {
    this.gotAnswer = true;

    if (this.state.val >= ENUM.state.active.val) {
      return;
    }

    const afterOrAtEarly = this.state.val >= ENUM.state.early.val;
    if (afterOrAtEarly) {
      this.setState(ENUM.state.active);
      return;
    }

    const shouldDelayForNow = this.gotEarly;
    if (shouldDelayForNow) {
      return;
    }

    this.rtc.answer(
      sdp,
      () => {
        this.setState(ENUM.state.active);
      },
      error => {
        printError('Error while answering', error);
        this.hangup();
      },
    );
  }

  getDestinationNumber() {
    return this.params.destination_number;
  }

  getId() {
    return this.params.callID;
  }

  getCallerIdentification({useCaracterEntities}) {
    return [
      this.params.remote_caller_id_name,
      ' ',
      useCaracterEntities ? '&lt;' : '<',
      this.params.remote_caller_id_number,
      useCaracterEntities ? '&gt;' : '>',
    ].join('');
  }

  handleInfo(params) {
    this.verto.callbacks.onInfo(params);
  }

  handleDisplay(displayName, displayNumber) {
    if (displayName !== undefined) {
      this.params.remote_caller_id_name = displayName;
    }

    if (displayNumber !== undefined) {
      this.params.remote_caller_id_number = displayNumber;
    }

    this.verto.callbacks.onDisplay({
      name: displayName,
      number: displayNumber,
    });
  }

  handleMedia(sdp) {
    if (this.state.val >= ENUM.state.early.val) {
      return;
    }

    this.gotEarly = true;

    this.rtc.answer(
      sdp,
      () => {
        this.setState(ENUM.state.early);

        if (this.gotAnswer) {
          this.setState(ENUM.state.active);
        }
      },
      error => {
        printError('Error on answering early', error);
        this.hangup();
      },
    );
  }

  toString() {
    const {
      callID: id,
      destination_number: destination,
      caller_id_name: callerName,
      caller_id_number: callerNumber,
      remote_caller_id_name: calleeName,
      remote_caller_id_number: calleeNumber,
    } = this.params;

    const attributes = [
      {key: 'id', value: id},
      {key: 'destination', value: destination},
      {key: 'from', value: `${callerName} (${callerNumber})`},
      {key: 'to', value: `${calleeName} (${calleeNumber})`},
    ]
      .map(({key, value}) => `${key}: "${value}"`)
      .join(', ');
    return `Call<${attributes}>`;
  }
}
