import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import './VideoCall.css';

/**
 * VideoCall component for handling video and audio calls using WebRTC and Socket.IO.
 */
function VideoCall() {
  // useRef hooks to hold references to the peer connections and socket instance.
  const localPeerConnection = useRef(null);
  const remotePeerConnection = useRef(null);
  const socket = useRef(null);

  // useState hooks to manage local video stream, audio mute state, and video off state.
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // useRef to store the remote user's ID.
  const remoteUserId = useRef(null);
  // Static room ID for the video call.
  const roomId = "room-123";

  // useEffect hook to initialize the WebRTC connection and Socket.IO communication.
  useEffect(() => {
    // Connect to the Socket.IO server.  Replace with your actual server address.
    socket.current = io.connect('https://Your_Local_IP_Address:3000/');

    // Emit 'join-room' event when connected to the Socket.IO server.
    socket.current.on('connect', () => {
      socket.current.emit('join-room', roomId, socket.current.id);
    });

    // Configuration for the RTCPeerConnection. Includes STUN server for NAT traversal.
    const configuration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    // Initialize local and remote peer connections.
    localPeerConnection.current = new RTCPeerConnection(configuration);
    remotePeerConnection.current = new RTCPeerConnection(configuration);

    // Listen for ICE candidates on the local peer connection.
    localPeerConnection.current.onicecandidate = ({ candidate }) => {
      if (candidate) {
        // When a new ICE candidate is generated, send it to the remote user through the signaling server.
        if (remoteUserId.current) {
          socket.current.emit('ice-candidate', { candidate, roomId, targetUserId: remoteUserId.current });
        } else {
          console.error('ICE candidate error: No remote user ID available.');
        }
      }
    };

    // Handle incoming ICE candidates from the remote peer.
    socket.current.on('ice-candidate', ({ candidate }) => {
      // Add the received ICE candidate to the remote peer connection.
      remotePeerConnection.current.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(e => console.error('Error adding received ICE candidate', e));
    });

    // Handle offer from remote user.
    socket.current.on('offer', ({ offer, senderId }) => {
      remoteUserId.current = senderId;
      // Set the remote description and create an answer.
      remotePeerConnection.current.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => remotePeerConnection.current.createAnswer())
        .then(answer => remotePeerConnection.current.setLocalDescription(answer).then(() => answer))
        .then(answer => {
          // Send the answer back to the remote user.
          socket.current.emit('answer', { answer, roomId, targetUserId: senderId });
        })
        .catch(err => console.error('Error handling offer', err));
    });

    // Handle answer from remote user.
    socket.current.on('answer', ({ answer, senderId }) => {
      remoteUserId.current = senderId;
      // Set the remote description on the local peer connection.
      localPeerConnection.current.setRemoteDescription(new RTCSessionDescription(answer))
        .catch(err => console.error('Error setting remote description for answer', err));
    });

    // Get user media (audio and video).
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        // Set the local stream to the local video element.
        const localVideo = document.getElementById('localVideo');
        if (localVideo) localVideo.srcObject = stream;
        setLocalStream(stream);

        // Add tracks from the local stream to the peer connections.
        stream.getTracks().forEach(track => {
          localPeerConnection.current.addTrack(track, stream);
          remotePeerConnection.current.addTrack(track, stream);
        });
      })
      .catch((error) => {
        console.error('Error accessing media devices.', error);
      });

    // Handle incoming media tracks from the remote peer.
    remotePeerConnection.current.ontrack = (event) => {
      // Set the remote stream to the remote video element.
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) remoteVideo.srcObject = event.streams[0];
    };

    // Cleanup function to disconnect the call when the component unmounts.
    return () => {
      disconnectCall();
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount.

  /**
   * Initiates the call by creating an offer and sending it to the target user.
   */
  function createOffer() {
    // Get the list of users in the room from the server.
    socket.current.emit('get-users', roomId, (users) => {
      // Find the target user (the user other than the current user).
      const targetUser = users.find(id => id !== socket.current.id);
      if (targetUser) {
        remoteUserId.current = targetUser;
        // Create an offer.
        localPeerConnection.current.createOffer()
          .then(offer => localPeerConnection.current.setLocalDescription(offer).then(() => offer))
          .then(offer => {
            // Send the offer to the target user.
            socket.current.emit('offer', { offer, roomId, targetUserId: targetUser });
          })
          .catch(error => console.error('Error creating offer:', error));
      } else {
        console.error('No target user found in room.');
      }
    });
  }

  /**
   * Disconnects the call by closing the peer connections and disconnecting from the socket.
   */
  function disconnectCall() {
    if (localPeerConnection.current) {
      localPeerConnection.current.close();
      localPeerConnection.current = null;
    }
    if (remotePeerConnection.current) {
      remotePeerConnection.current.close();
      remotePeerConnection.current = null;
    }
    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }
  }

  /**
   * Toggles the audio mute state.
   */
  function toggleAudio() {
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = !isAudioMuted;
      setIsAudioMuted(!isAudioMuted);
    }
  }

  /**
   * Toggles the video off state.
   */
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
        <video id="localVideo" autoPlay playsInline muted className="video"></video>
        <video id="remoteVideo" autoPlay playsInline className="video"></video>
      </div>
      <div className="controls">
        <button onClick={createOffer}>Start Call</button>
        <button onClick={toggleAudio}>{isAudioMuted ? 'Unmute' : 'Mute'}</button>
        <button onClick={toggleVideo}>{isVideoOff ? 'Turn Video On' : 'Turn Video Off'}</button>
        <button onClick={disconnectCall}>Disconnect Call</button>
      </div>
    </div>
  );
}

export default VideoCall;