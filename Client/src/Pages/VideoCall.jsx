import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import './VideoCall.css';

function VideoCall() {
  const localPeerConnection = useRef(null);
  const remotePeerConnection = useRef(null);
  const socket = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  // Store the remote user's socket id once discovered
  const remoteUserId = useRef(null);
  const roomId = "room-123";

  useEffect(() => {
    // Replace <YOUR_MACHINE_IP> with your development machine's IP address
    // and ensure you are using HTTPS.
    socket.current = io.connect('https://192.168.101.41:3000/');
    console.log('Socket initiated.');

    socket.current.on('connect', () => {
      console.log('Socket connected with id:', socket.current.id);
      socket.current.emit('join-room', roomId, socket.current.id);
      console.log(`Joined room ${roomId} as ${socket.current.id}`);
    });

    const configuration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    // Create peer connections for local and remote streams.
    localPeerConnection.current = new RTCPeerConnection(configuration);
    remotePeerConnection.current = new RTCPeerConnection(configuration);

    // Send ICE candidates from the local peer along with the target remote user's ID.
    localPeerConnection.current.onicecandidate = ({ candidate }) => {
      if (candidate) {
        if (remoteUserId.current) {
          console.log('Local ICE candidate:', candidate);
          socket.current.emit('ice-candidate', { candidate, roomId, targetUserId: remoteUserId.current });
        } else {
          console.error('ICE candidate error: No remote user ID available.');
        }
      }
    };

    // When receiving ICE candidates from the other peer, add them.
    socket.current.on('ice-candidate', ({ candidate }) => {
      console.log('Received ICE candidate:', candidate);
      remotePeerConnection.current.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(e => console.error('Error adding received ICE candidate', e));
    });

    // Handle incoming offers.
    socket.current.on('offer', ({ offer, senderId }) => {
      console.log('Received offer:', offer);
      // Save the remote user's socket id.
      remoteUserId.current = senderId;
      remotePeerConnection.current.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => remotePeerConnection.current.createAnswer())
        .then(answer => remotePeerConnection.current.setLocalDescription(answer).then(() => answer))
        .then(answer => {
          socket.current.emit('answer', { answer, roomId, targetUserId: senderId });
          console.log('Sent answer:', answer);
        })
        .catch(err => console.error('Error handling offer', err));
    });

    // Handle incoming answers.
    socket.current.on('answer', ({ answer, senderId }) => {
      console.log('Received answer:', answer);
      // Save the remote user's socket id.
      remoteUserId.current = senderId;
      localPeerConnection.current.setRemoteDescription(new RTCSessionDescription(answer))
        .catch(err => console.error('Error setting remote description for answer', err));
    });

    // Get user media (audio and video) and attach to local video element.
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        console.log('Got local stream:', stream);
        const localVideo = document.getElementById('localVideo');
        if (localVideo) localVideo.srcObject = stream;
        setLocalStream(stream);
        // Add tracks to both peer connections.
        stream.getTracks().forEach(track => {
          localPeerConnection.current.addTrack(track, stream);
          remotePeerConnection.current.addTrack(track, stream);
        });
      })
      .catch((error) => {
        console.error('Error accessing media devices.', error);
      });

    // When remote peer connection receives a track, attach it to remote video.
    remotePeerConnection.current.ontrack = (event) => {
      console.log('Received remote stream:', event.streams[0]);
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) remoteVideo.srcObject = event.streams[0];
    };

    return () => {
      if (localPeerConnection.current) localPeerConnection.current.close();
      if (remotePeerConnection.current) remotePeerConnection.current.close();
      if (socket.current) socket.current.disconnect();
    };
  }, []);

  // Create an offer. First, ask the server for the list of users in the room.
  function createOffer() {
    console.log('Creating offer...');
    socket.current.emit('get-users', roomId, (users) => {
      // Pick a target user different from ourselves.
      const targetUser = users.find(id => id !== socket.current.id);
      if (targetUser) {
        remoteUserId.current = targetUser;
        localPeerConnection.current.createOffer()
          .then(offer => localPeerConnection.current.setLocalDescription(offer).then(() => offer))
          .then(offer => {
            socket.current.emit('offer', { offer, roomId, targetUserId: targetUser });
            console.log(`Offer sent to ${targetUser} in room ${roomId}`, offer);
          })
          .catch(error => console.error('Error creating offer:', error));
      } else {
        console.error('No target user found in room.');
      }
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
