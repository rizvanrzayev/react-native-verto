/**
 * react-native-verto
 * Author: Rizvan Rzayev
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * And see https://github.com/rizvanrzayev/react-native-verto for the full license details.
 */
import {printError} from '../common/utils';

export const traceMediaError = (constraints, error) =>
  printError('User media error', 'Constraints:', constraints, 'Error:', error);

const getMediaElement = element => {
  // if (!element) {
  //   printError('Invalid media element', element);
  // }
  // if (typeof element === 'string') {
  //   const domNode = document.getElementById(element);
  //   return domNode || printError('Invalid id', element);
  // }
  // return element;
};

export const deactivateMediaNode = video => {
  // const element = getMediaElement(video);
  // if (element && element.srcObject && element.srcObject.active) {
  //   element.style.display = 'none';
  //   element.srcObject.getTracks().forEach(track => track.stop());
  //   element.srcObject = null;
  // }
};

export const activateMediaNode = (video, stream) => {
  // const element = getMediaElement(video);
  // if (element && stream !== undefined) {
  //   element.style.display = 'block';
  //   element.srcObject = stream;
  // }
};
