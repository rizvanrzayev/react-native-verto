import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'red',
    width: '100%',
    height: '100%',
  },
  localStreamContainer: {
    flex: 0.5,
    height: '50%',
    width: '100%',
  },
  localStream: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  remoteStreamContainer: {
    flex: 0.5,
    height: '50%',
    width: '100%',
  },
  remoteStream: {
    flex: 1,
    height: '100%',
    width: '100%',
  }
})

export default styles;
