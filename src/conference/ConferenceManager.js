/**
 * react-native-verto
 * Author: Rizvan Rzayev
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * And see https://github.com/rizvanrzayev/react-native-verto for the full license details.
 */
import { printWarning } from '../common/utils';

let gSerialNumber = 0;

export default class ConferenceManager {
  constructor(verto, subscriptions) {
    this.verto = verto;
    this.subscriptions = {
      info: {
        channel: null,
        handler: null,
      },
      chat: {
        channel: null,
        handler: null,
      },
      mod: {
        channel: null,
        handler: null,
      },
      ...subscriptions,
    };

    this.serno = gSerialNumber;
    gSerialNumber += 1;

    Object.keys(this.subscriptions).forEach((key) => {
      const { channel, handler } = this.subscriptions[key] || {};
      if (channel && handler) {
        this.verto.subscribe(channel, { handler });
      }
    });
    this.destroyed = false;
  }

  destroy() {
    Object.keys(this.subscriptions).forEach((key) => {
      const { channel } = this.subscriptions[key] || {};
      if (channel) {
        this.verto.unsubscribe(channel);
      }
    });
    this.destroyed = true;
  }

  broadcast(eventChannel, data) {
    if (this.destroyed) {
      printWarning('Tried to broadcast from destroyed conference manager.');
      return;
    }

    if (!eventChannel) {
      return;
    }

    this.verto.publish('verto.broadcast', { eventChannel, data });
  }

  broadcastModeratorCommand(command, memberId, argument) {
    this.broadcast(this.subscriptions.mod.channel, {
      command,
      id: memberId && parseInt(memberId, 10),
      value: argument,
      application: 'conf-control',
    });
  }

  broadcastRoomCommand(command, argument) {
    this.broadcastModeratorCommand(command, null, argument);
  }

  broadcastChatMessage(text) {
    this.broadcast(this.subscriptions.chat.channel, {
      message: text,
      action: 'send',
      type: 'message',
    });
  }

  askVideoLayouts() {
    this.broadcastRoomCommand('list-videoLayouts');
  }

  playMediaFileFromServer(filename) {
    this.broadcastRoomCommand('play', filename);
  }

  stopMediaFilesFromServer() {
    this.broadcastRoomCommand('stop', 'all');
  }

  startRecordingOnServer(filename) {
    this.broadcastRoomCommand('recording', ['start', filename]);
  }

  stopRecordingsOnServer() {
    this.broadcastRoomCommand('recording', ['stop', 'all']);
  }

  saveSnapshotOnServer(filename) {
    this.broadcastRoomCommand('vid-write-png', filename);
  }

  changeVideoLayout(layout, canvas) {
    this.broadcastRoomCommand('vid-layout', canvas ? [layout, canvas] : layout);
  }

  moderateMemberById(memberId) {
    const constantBroadcasterFor = command => argument => () => {
      this.broadcastModeratorCommand(command, memberId, argument);
    };

    const parameterizedBroadcasterFor = command => (argument) => {
      this.broadcastModeratorCommand(command, memberId, argument);
    };

    const parameterizedBroadcasterForSettingVideoBanner = () => (text) => {
      this.broadcastModeratorCommand('vid-banner', memberId, 'reset');

      if (text.trim().toLowerCase() === 'reset') {
        this.broadcastModeratorCommand('vid-banner', memberId, `${text}\n`);
      } else {
        this.broadcastModeratorCommand('vid-banner', memberId, text);
      }
    };

    const constantBroadcasterForCleaningVideoBanner = () => () => {
      this.broadcastModeratorCommand('vid-banner', memberId, 'reset');
    };

    return {
      toBeNotDeaf: constantBroadcasterFor('undeaf')(),
      toBeDeaf: constantBroadcasterFor('deaf')(),
      toBeKickedOut: constantBroadcasterFor('kick')(),
      toToggleMicrophone: constantBroadcasterFor('tmute')(),
      toToggleCamera: constantBroadcasterFor('tvmute')(),
      toBePresenter: constantBroadcasterFor('vid-res-id')('presenter'),
      toBeVideoFloor: constantBroadcasterFor('vid-floor')('force'),
      toHaveVideoBannerAs: parameterizedBroadcasterForSettingVideoBanner(),
      toCleanVideoBanner: constantBroadcasterForCleaningVideoBanner(),
      toIncreaseVolumeOutput: constantBroadcasterFor('volume_out')('up'),
      toDecreaseVolumeOutput: constantBroadcasterFor('volume_out')('down'),
      toIncreaseVolumeInput: constantBroadcasterFor('volume_in')('up'),
      toDecreaseVolumeInput: constantBroadcasterFor('volume_in')('down'),
      toTransferTo: parameterizedBroadcasterFor('transfer'),
    };
  }
}
