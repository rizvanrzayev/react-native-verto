/**
 * react-native-verto
 * Author: Rizvan Rzayev
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * And see https://github.com/rizvanrzayev/react-native-verto for the full license details.
 */
import { printWarning } from '../common/utils';

export default class ConferenceLiveArray {
  constructor(verto, liveArrayChannel, conferenceName, callbacks = {}) {
    this.hashTable = {};
    this.orderedCallIds = [];
    this.lastSerialNumber = 0;
    this.serialNumberErrors = 0;

    this.verto = verto;
    this.liveArrayChannel = liveArrayChannel;
    this.conferenceName = conferenceName;
    this.callbacks = {
      onBootstrappedMembers: x => x,
      onAddedMember: x => x,
      onModifiedMember: x => x,
      onRemovedMember: x => x,
      ...callbacks,
    };

    this.subscription = verto.subscribe(liveArrayChannel, {
      handler: this.handleEvent.bind(this),
      userData: this,
    });
    this.destroyed = false;

    this.bootstrap();
  }

  destroy() {
    this.verto.unsubscribe(this.subscription.eventChannel);
    this.destroyed = true;
  }

  insertValue(callId, value, insertAt) {
    if (this.hashTable[callId]) {
      return;
    }

    this.hashTable[callId] = value;

    if (insertAt === undefined || insertAt < 0 || insertAt >= this.orderedCallIds.length) {
      this.orderedCallIds = [...this.orderedCallIds, callId];
      return;
    }

    this.orderedCallIds = this.orderedCallIds.reduce((accumulator, currentCallId, currentIndex) => {
      if (currentIndex === insertAt) {
        return [...accumulator, callId, currentCallId];
      }

      return [...accumulator, currentCallId];
    }, []);
  }

  deleteValue(callId) {
    if (!this.hashTable[callId]) {
      return false;
    }

    this.orderedCallIds = this.orderedCallIds.filter(existingCallId => existingCallId !== callId);
    delete this.hashTable[callId];
    return true;
  }

  checkSerialNumber(serialNumber) {
    if (this.lastSerialNumber > 0 && serialNumber !== (this.lastSerialNumber + 1)) {
      this.serialNumberErrors += 1;
      if (this.serialNumberErrors < 3) {
        this.bootstrap();
      }
      return false;
    }

    if (serialNumber > 0) {
      this.lastSerialNumber = serialNumber;
    }

    return true;
  }

  handleBootingEvent(eventSerialNumber, dataArray) {
    if (!this.checkSerialNumber(eventSerialNumber)) {
      return;
    }

    dataArray.forEach((data) => {
      const [callId, value] = data;
      this.insertValue(callId, value);
    });

    this.callbacks.onBootstrappedMembers({ dataArray });
  }

  handleAddingEvent(eventSerialNumber, value, callId, index) {
    if (!this.checkSerialNumber(eventSerialNumber)) {
      return;
    }

    this.insertValue(callId || eventSerialNumber, value, index);
    this.callbacks.onAddedMember(value);
  }

  handleModifyingEvent(eventSerialNumber, value, callId, index) {
    if (!this.checkSerialNumber(eventSerialNumber)) {
      return;
    }

    this.insertValue(callId || eventSerialNumber, value, index);
    this.callbacks.onModifiedMember(value);
  }

  handleDeleteEvent(eventSerialNumber, callId, index) {
    if (!this.checkSerialNumber(eventSerialNumber)) {
      return;
    }

    const eventIndexIsInvalid = (index === null) || (index === undefined) || (index < 0);
    const localIndex = this.orderedCallIds.indexOf(callId || eventSerialNumber);

    const isDiffAfterBoot = this.deleteValue(callId || eventSerialNumber);
    if (!isDiffAfterBoot) {
      return;
    }

    const report = { callId, index: eventIndexIsInvalid ? localIndex : index };
    this.callbacks.onRemovedMember(report);
  }

  handleEvent(event, liveArray) {
    const {
      wireSerno: serialNumber,
      arrIndex: arrayIndex,
      name: conferenceName,
      data: payload,
      hashKey: callId,
      action,
    } = event.data;

    if (conferenceName !== liveArray.conferenceName) {
      return;
    }

    switch (action) {
      case 'bootObj':
        this.handleBootingEvent(serialNumber, payload);
        break;
      case 'add':
        this.handleAddingEvent(serialNumber, payload, callId, arrayIndex);
        break;
      case 'modify':
        if (arrayIndex || callId) {
          this.handleModifyingEvent(serialNumber, payload, callId, arrayIndex);
        }
        break;
      case 'del':
        if (arrayIndex || callId) {
          this.handleDeleteEvent(serialNumber, callId, arrayIndex);
        }
        break;
      default:
        printWarning('Ignoring not implemented live array action', action);
        break;
    }
  }

  bootstrap() {
    this.verto.broadcast(this.liveArrayChannel, {
      liveArray: {
        command: 'bootstrap',
        context: this.liveArrayChannel,
        name: this.conferenceName,
      },
    });
  }
}
