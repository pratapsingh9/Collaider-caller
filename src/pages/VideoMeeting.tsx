import React from 'react';
import { Mic, MicOff, Video, VideoOff, MessageSquare, Phone, Send, X, Move, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- TYPE DEFINITIONS ---
interface Message {
  id: number;
  sender: string;
  text: string;
  isSelf: boolean;
}

interface Participant {
  id: string;
  name: string;
  isSelf?: boolean;
}

interface VideoMeetingProps {
  username: string;
  roomId: string;
  onLeave: () => void;
}

// --- HELPER COMPONENTS ---

/**
 * Represents a single participant's video view.
 */
const ParticipantView: React.FC<{
  name: string;
  isSelf?: boolean;
  isVideoOff?: boolean;
  isMuted?: boolean;
  isMainView?: boolean;
}> = ({ name, isSelf = false, isVideoOff = false, isMuted = false, isMainView = false }) => {
  const avatar = (
    <div className="w-full h-full flex items-center justify-center bg-gray-800">
      <div className={`rounded-full flex items-center justify-center bg-gray-700 ${isMainView ? 'w-32 h-32' : 'w-20 h-20'}`}>
        <span className={`font-bold text-gray-400 ${isMainView ? 'text-5xl' : 'text-3xl'}`}>{name.charAt(0).toUpperCase()}</span>
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden shadow-2xl border-2 border-transparent data-[isself=true]:border-blue-500" data-isself={isSelf}>
      {isVideoOff ? (
        avatar
      ) : (
        <video
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted={isSelf} // Self view should always be muted to prevent feedback
          style={{ transform: 'scaleX(-1)' }} // Mirror self-view
        >
           {/* In a real app, you would set the srcObject to a MediaStream */}
        </video>
      )}
       <div className="absolute top-0 right-0 p-2 bg-black/30 rounded-bl-lg">
          {isMuted && <MicOff size={18} className="text-white" />}
       </div>
      <div className="absolute bottom-0 left-0 bg-black/50 px-3 py-1.5 rounded-tr-lg">
        <p className="text-sm font-medium text-white">{name} {isSelf && '(You)'}</p>
      </div>
    </div>
  );
};


/**
 * Draggable self-view window.
 */
const SelfView: React.FC<{ participant: Participant; isVideoOff: boolean; isMuted: boolean }> = ({ participant, isVideoOff, isMuted }) => {
    const [position, setPosition] = React.useState({ x: 20, y: 20 });
    const [isDragging, setIsDragging] = React.useState(false);
    const dragStartPos = React.useRef({ x: 0, y: 0 });
    const selfViewRef = React.useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!selfViewRef.current) return;
        setIsDragging(true);
        dragStartPos.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
        selfViewRef.current.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDragging || !selfViewRef.current) return;
        const parentRect = selfViewRef.current.parentElement?.getBoundingClientRect();
        if (!parentRect) return;

        let newX = e.clientX - dragStartPos.current.x;
        let newY = e.clientY - dragStartPos.current.y;

        // Constrain movement within the parent
        newX = Math.max(0, Math.min(newX, parentRect.width - selfViewRef.current.offsetWidth));
        newY = Math.max(0, Math.min(newY, parentRect.height - selfViewRef.current.offsetHeight));


        setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        if (selfViewRef.current) {
            selfViewRef.current.style.cursor = 'grab';
        }
    };

    React.useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isDragging) {
                handleMouseUp();
            }
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [isDragging]);


    return (
        <div
            ref={selfViewRef}
            className="absolute z-20 w-48 h-36 md:w-64 md:h-48 shadow-lg rounded-lg transition-all duration-300"
            style={{ top: `${position.y}px`, left: `${position.x}px` }}
            onMouseMove={handleMouseMove}
        >
            <div
                className="absolute top-2 right-2 z-30 p-2 bg-black/40 rounded-full text-white cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
            >
                <Move size={16} />
            </div>
            <ParticipantView name={participant.name} isSelf isVideoOff={isVideoOff} isMuted={isMuted} />
        </div>
    );
};


/**
 * The chat panel component.
 */
const ChatPanel: React.FC<{ isOpen: boolean; onClose: () => void; username: string }> = ({ isOpen, onClose, username }) => {
  const [messages, setMessages] = React.useState<Message[]>([
    { id: 1, sender: 'Jane Doe', text: 'Hey! Ready for our call?', isSelf: false },
    { id: 2, sender: username, text: 'Yep, all set! How are you?', isSelf: true },
    { id: 3, sender: 'Jane Doe', text: "Doing great, thanks for asking. Let's get started.", isSelf: false },
  ]);
  const [newMessage, setNewMessage] = React.useState('');
  const chatBodyRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      setMessages([...messages, {
        id: Date.now(),
        sender: username,
        text: newMessage,
        isSelf: true,
      }]);
      setNewMessage('');
    }
  };

  return (
    <div className={`absolute top-0 right-0 h-full flex flex-col bg-gray-950/80 backdrop-blur-lg border-l border-gray-700 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} w-full md:w-96 z-30`}>
      <header className="p-4 flex justify-between items-center border-b border-gray-700">
        <h3 className="font-bold text-lg text-white">Meeting Chat</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full">
          <X size={20} />
        </button>
      </header>
      <div ref={chatBodyRef} className="flex-1 p-4 space-y-4 overflow-y-auto">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}>
            <div className={`p-3 rounded-xl max-w-xs text-white ${msg.isSelf ? 'bg-blue-600 rounded-br-none' : 'bg-gray-700 rounded-bl-none'}`}>
              {!msg.isSelf && <p className="text-xs text-blue-300 font-bold mb-1">{msg.sender}</p>}
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type a message..."
        />
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-colors">
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

/**
 * The main control bar for the meeting.
 */
const ControlBar: React.FC<{
  isMuted: boolean;
  onMuteToggle: () => void;
  isVideoOff: boolean;
  onVideoToggle: () => void;
  onChatToggle: () => void;
  onLeave: () => void;
}> = ({ isMuted, onMuteToggle, isVideoOff, onVideoToggle, onChatToggle, onLeave }) => (
  <div className="flex justify-center items-center gap-4">
    <button onClick={onMuteToggle} className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-700/80 text-white hover:bg-gray-600'}`}>
      {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
    </button>
    <button onClick={onVideoToggle} className={`p-3 rounded-full transition-colors ${isVideoOff ? 'bg-red-500 text-white' : 'bg-gray-700/80 text-white hover:bg-gray-600'}`}>
      {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
    </button>
    <button onClick={onChatToggle} className="p-3 bg-gray-700/80 text-white hover:bg-gray-600 rounded-full transition-colors">
      <MessageSquare size={24} />
    </button>
     <button className="p-3 bg-gray-700/80 text-white hover:bg-gray-600 rounded-full transition-colors">
      <Users size={24} />
    </button>
    <div className="w-px h-8 bg-gray-600 mx-2"></div>
    <button onClick={onLeave} className="px-5 py-3 bg-red-600 hover:bg-red-700 rounded-full font-semibold flex items-center gap-2 text-white transition-colors">
      <Phone size={20} />
    </button>
  </div>
);



const App: React.FC = () => {
    const navigate = useNavigate();
    // Dummy props for demonstration
    const videoMeetingProps: VideoMeetingProps = {
        username: 'Alex Ray',
        roomId: 'dev-talk',
        onLeave: () => {
            alert('Meeting Leaved');
            setTimeout(() => {
                navigate('/');
            }, 200);
        },
    };

    return (
        <div className="w-full h-screen text-white font-sans">
            <VideoMeeting {...videoMeetingProps} />
        </div>
    );
};


const VideoMeeting: React.FC<VideoMeetingProps> = ({ username, roomId, onLeave }) => {
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(false);
  const [isVideoOff, setIsVideoOff] = React.useState(false);

  // For a 2-person call, we have the user and one other participant.
  const self: Participant = { id: 'user-self', name: username, isSelf: true };
  const otherParticipant: Participant = { id: 'user-other', name: 'Jane Doe' };


  return (
    <div className="w-full h-full flex flex-col bg-gray-950">
      {/* Main Video Area */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Other Participant's Video (Main View) */}
        <div className="w-full h-full">
            <ParticipantView
                name={otherParticipant.name}
                isVideoOff={false} // Let's assume the other person's video is on
                isMuted={false} // And they are not muted
                isMainView
            />
        </div>

        {/* Self Video (Draggable Pip) */}
        <SelfView
            participant={self}
            isVideoOff={isVideoOff}
            isMuted={isMuted}
        />

        {/* Chat Panel (Slides from the side) */}
        <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} username={username} />
      </main>

      {/* Controls */}
      <footer className="absolute bottom-0 left-0 right-0 p-4 z-20 bg-gradient-to-t from-black/70 to-transparent">
        <ControlBar
          isMuted={isMuted}
          onMuteToggle={() => setIsMuted(!isMuted)}
          isVideoOff={isVideoOff}
          onVideoToggle={() => setIsVideoOff(!isVideoOff)}
          onChatToggle={() => setIsChatOpen(!isChatOpen)}
          onLeave={onLeave}
        />
      </footer>
    </div>
  );
};

export default App;
