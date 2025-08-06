import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, MessageSquare, Phone, Send, X, Users, Clock } from 'lucide-react';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isSelf: boolean;
}

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  isSelf?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
}

interface VideoMeetingProps {
  username: string;
  roomId: string;
  onLeave: () => void;
}

export default function VideoMeeting({ username, roomId, onLeave }: VideoMeetingProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState('00:00');
  
  const wsRef = useRef<WebSocket>();
  const localStreamRef = useRef<MediaStream>();
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const selfParticipantRef = useRef<Participant>();

  useEffect(() => {
    // Initialize WebSocket connection
    const ws = new WebSocket(`ws://localhost:8080`);
    wsRef.current = ws;

    // Initialize media and WebRTC
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        localStreamRef.current = stream;
        
        const selfParticipant: Participant = {
          id: 'self',
          name: username,
          isSelf: true,
          isMuted: false,
          isVideoOff: false,
          stream
        };
        
        selfParticipantRef.current = selfParticipant;
        setParticipants([selfParticipant]);
      } catch (error) {
        console.error('Error accessing media devices:', error);
        // Create participant without stream
        const selfParticipant: Participant = {
          id: 'self',
          name: username,
          isSelf: true,
          isMuted: true,
          isVideoOff: true
        };
        selfParticipantRef.current = selfParticipant;
        setParticipants([selfParticipant]);
      }
    };

    initMedia();

    // WebSocket message handlers
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'EXISTING_PARTICIPANTS':
          handleExistingParticipants(data.payload.participants);
          break;
        case 'NEW_PARTICIPANT':
          handleNewParticipant(data.payload);
          break;
        case 'PARTICIPANT_LEFT':
          handleParticipantLeft(data.payload.id);
          break;
        case 'SIGNAL':
          handleSignal(data.payload);
          break;
        case 'NEW_MESSAGE':
          handleNewMessage(data.payload);
          break;
        case 'PARTICIPANT_STATE_CHANGED':
          handleParticipantStateChanged(data.payload);
          break;
      }
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'JOIN_ROOM',
        payload: { roomId, username }
      }));
    };

    // Call duration timer
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const seconds = (elapsed % 60).toString().padStart(2, '0');
      setCallDuration(`${minutes}:${seconds}`);
    }, 1000);

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      ws.close();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    };
  }, [roomId, username]);

  // WebRTC functions
  const createPeerConnection = (participantId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Add TURN servers here if needed
      ]
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsRef.current?.send(JSON.stringify({
          type: 'SIGNAL',
          payload: {
            to: participantId,
            signal: { type: 'ice', candidate: event.candidate.toJSON() }
          }
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state for ${participantId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    pc.ontrack = (event) => {
      if (!event.streams || event.streams.length === 0) return;
      const stream = event.streams[0];
      setParticipants(prev => prev.map(p => 
        p.id === participantId ? { ...p, stream } : p
      ));
    };

    return pc;
  };

  const handleExistingParticipants = (existingParticipants: any[]) => {
    existingParticipants.forEach(participant => {
      if (participant.id !== selfParticipantRef.current?.id) {
        const newParticipant: Participant = {
          id: participant.id,
          name: participant.username,
          isMuted: false,
          isVideoOff: false
        };
        setParticipants(prev => [...prev, newParticipant]);
        initiateCall(participant.id);
      }
    });
  };

  const handleNewParticipant = (payload: any) => {
    const newParticipant: Participant = {
      id: payload.id,
      name: payload.username,
      isMuted: false,
      isVideoOff: false
    };
    setParticipants(prev => [...prev, newParticipant]);
    initiateCall(payload.id);
  };

  const initiateCall = async (participantId: string) => {
    const pc = createPeerConnection(participantId);
    peerConnectionsRef.current[participantId] = pc;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      wsRef.current?.send(JSON.stringify({
        type: 'SIGNAL',
        payload: {
          to: participantId,
          signal: { type: 'offer', sdp: offer.sdp }
        }
      }));
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleSignal = async (payload: any) => {
    const { from, signal } = payload;
    let pc = peerConnectionsRef.current[from];
    
    if (!pc) {
      pc = createPeerConnection(from);
      peerConnectionsRef.current[from] = pc;
    }

    try {
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        wsRef.current?.send(JSON.stringify({
          type: 'SIGNAL',
          payload: {
            to: from,
            signal: { type: 'answer', sdp: answer.sdp }
          }
        }));
      } 
      else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } 
      else if (signal.type === 'ice') {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  };

  const handleParticipantLeft = (participantId: string) => {
    if (peerConnectionsRef.current[participantId]) {
      peerConnectionsRef.current[participantId].close();
      delete peerConnectionsRef.current[participantId];
    }
    setParticipants(prev => prev.filter(p => p.id !== participantId));
  };

  const handleNewMessage = (message: any) => {
    setMessages(prev => [...prev, {
      ...message,
      isSelf: message.senderId === selfParticipantRef.current?.id
    }]);
  };

  const handleParticipantStateChanged = (payload: any) => {
    setParticipants(prev => prev.map(p => 
      p.id === payload.participantId ? { ...p, ...payload.state } : p
    ));
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    wsRef.current?.send(JSON.stringify({
      type: 'SEND_MESSAGE',
      payload: { text: newMessage }
    }));
    setNewMessage('');
  };

  const toggleAudio = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMutedState;
      });
    }
    
    wsRef.current?.send(JSON.stringify({
      type: 'STATE_CHANGE',
      payload: { audio: !newMutedState }
    }));
  };

  const toggleVideo = () => {
    const newVideoState = !isVideoOff;
    setIsVideoOff(newVideoState);
    
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !newVideoState;
      });
    }
    
    wsRef.current?.send(JSON.stringify({
      type: 'STATE_CHANGE',
      payload: { video: !newVideoState }
    }));
  };

  const mainParticipant = participants.find(p => !p.isSelf) || participants[0];
  const selfParticipant = participants.find(p => p.isSelf);

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-white relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center bg-black/30 z-10">
        <div className="flex items-center gap-2">
          <span className="font-medium">Room: {roomId}</span>
          <span className="flex items-center gap-1 text-sm">
            <Users size={14} /> {participants.length}
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Clock size={14} /> {callDuration}
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 relative">
        {mainParticipant && (
          <div className="w-full h-full">
            <ParticipantView 
              participant={mainParticipant} 
              isMainView 
            />
          </div>
        )}
        
        {selfParticipant && (
          <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-lg z-20">
            <ParticipantView participant={selfParticipant} />
          </div>
        )}
      </div>

      {/* Chat Panel */}
      {isChatOpen && (
        <div className="absolute top-0 right-0 h-full w-80 bg-gray-900 border-l border-gray-700 z-30">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-medium">Chat</h3>
            <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <div className="p-3 space-y-3 flex-1 overflow-y-auto h-[calc(100%-56px)]">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.isSelf ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs p-2 rounded-lg ${msg.isSelf ? 'bg-blue-600' : 'bg-gray-700'}`}>
                  <div className="flex justify-between text-xs mb-1">
                    {!msg.isSelf && <span>{msg.senderName}</span>}
                    <span className="text-gray-300">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} className="p-3 border-t border-gray-700 flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 bg-gray-800 rounded px-3 py-2 focus:outline-none"
              placeholder="Type a message..."
            />
            <button type="submit" className="bg-blue-600 text-white p-2 rounded">
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      {/* Participants Panel */}
      {isParticipantsOpen && (
        <div className="absolute top-0 right-0 h-full w-80 bg-gray-900 border-l border-gray-700 z-30">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-medium">Participants ({participants.length})</h3>
            <button onClick={() => setIsParticipantsOpen(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto">
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span>{p.name} {p.isSelf && '(You)'}</span>
                </div>
                {p.isMuted ? <MicOff size={16} className="text-red-400" /> : <Mic size={16} className="text-gray-400" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent z-20">
        <div className="flex justify-center gap-3">
          <button 
            onClick={toggleAudio} 
            className={`p-3 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-700'}`}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button 
            onClick={toggleVideo} 
            className={`p-3 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-gray-700'}`}
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
          <button 
            onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
            className="p-3 bg-gray-700 rounded-full"
          >
            <Users size={20} />
          </button>
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="p-3 bg-gray-700 rounded-full"
          >
            <MessageSquare size={20} />
          </button>
          <button 
            onClick={onLeave}
            className="p-3 bg-red-600 rounded-full"
          >
            <Phone size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Participant View Component
function ParticipantView({ participant, isMainView = false }: { 
  participant: Participant; 
  isMainView?: boolean 
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      {participant.isVideoOff ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className={`rounded-full bg-gray-700 flex items-center justify-center ${isMainView ? 'w-32 h-32' : 'w-20 h-20'}`}>
            <span className={`font-bold text-gray-400 ${isMainView ? 'text-5xl' : 'text-3xl'}`}>
              {participant.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted={participant.isSelf}
        />
      )}
      <div className="absolute top-2 right-2 p-1 bg-black/40 rounded-full">
        {participant.isMuted && <MicOff size={14} className="text-white" />}
      </div>
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-sm text-white">
        {participant.name} {participant.isSelf && '(You)'}
      </div>
    </div>
  );
}