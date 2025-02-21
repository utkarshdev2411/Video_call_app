import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import './VideoCall.css'; // Import the CSS file

function VideoCall() {
  const localPeerConnection = useRef(null);
  const remotePeerConnection = useRef(null);
  const socket = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    socket.current = io.connect('http://localhost:3000/'); // Use your local IP address
    console.log('Socket connected:', socket.current);

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' } // ASTUN server
      ]
    };

    localPeerConnection.current = new RTCPeerConnection(configuration);
    remotePeerConnection.current = new RTCPeerConnection(configuration);

    localPeerConnection.current.onicecandidate = ({ candidate }) => {
      if (candidate) {
        console.log('Local ICE candidate:', candidate);
        socket.current.emit('ice-candidate', candidate);
      }
    };

    socket.current.on('ice-candidate', (candidate) => {
      console.log('Remote ICE candidate:', candidate);
      remotePeerConnection.current.addIceCandidate(candidate);
    });

    socket.current.on('offer', (offer) => {
      console.log('Received offer:', offer);
      remotePeerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      remotePeerConnection.current.createAnswer()
        .then(answer => {
          remotePeerConnection.current.setLocalDescription(answer);
          socket.current.emit('answer', answer);
          console.log('Sent answer:', answer);
        });
    });

    socket.current.on('answer', (answer) => {
      console.log('Received answer:', answer);
      localPeerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        console.log('Got local stream:', stream);
        document.getElementById('localVideo').srcObject = stream;
        setLocalStream(stream);
        stream.getTracks().forEach(track => localPeerConnection.current.addTrack(track, stream));
      })
      .catch((error) => {
        console.error('Error accessing media devices.', error);
      });

    remotePeerConnection.current.ontrack = (event) => {
      console.log('Received remote stream:', event.streams[0]);
      document.getElementById('remoteVideo').srcObject = event.streams[0];
    };

    // Cleanup function to close connections when the component unmounts
    return () => {
      localPeerConnection.current.close();
      remotePeerConnection.current.close();
      socket.current.disconnect();
    };
  }, []);

  function createOffer() {
    console.log('Creating offer...');
    localPeerConnection.current.createOffer()
      .then(offer => {
        localPeerConnection.current.setLocalDescription(offer);
        socket.current.emit('offer', offer);
        console.log('Sent offer:', offer);
      })
      .catch(error => {
        console.error('Error creating offer:', error);
      });
  }

  function toggleAudio() {
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = !isAudioMuted;
      setIsAudioMuted(!isAudioMuted);
    }
  }

  function toggleVideo() {
    if (localStream) {
      localStream.getVideoTracks()[0].enabled = !isVideoOff;
      setIsVideoOff(!isVideoOff);
    }
  }

  return (
    <div className="video-call-container">
      <h2>Video Call</h2>
      <div className="video-container">
        <video id="localVideo" autoPlay playsInline className="video"></video>
        <video id="remoteVideo" autoPlay playsInline className="video"></video>
      </div>
      <div className="controls">
        <button onClick={createOffer}>Start Call</button>
        <button onClick={toggleAudio}>{isAudioMuted ? 'Unmute' : 'Mute'}</button>
        <button onClick={toggleVideo}>{isVideoOff ? 'Turn Video On' : 'Turn Video Off'}</button>
      </div>
    </div>
  );
}

export default VideoCall;