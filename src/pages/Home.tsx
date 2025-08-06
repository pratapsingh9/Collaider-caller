import { useState, useEffect, useRef, FC, Dispatch, SetStateAction } from 'react';
// Make sure you have lucide-react installed: npm install lucide-react
import { ChevronRight, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LobbyProps {
  username: string;
  setUsername: Dispatch<SetStateAction<string>>;
  roomId: string;
  setRoomId: Dispatch<SetStateAction<string>>;
  error: string;
  onJoin: () => void;
  onGenerateRoomId: () => void;
}





// Main App Component
const App: FC = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const navigate =  useNavigate();

  // --- Handlers ---
  const handleJoinRoom = () => {
    if (!username.trim() || !roomId.trim()) {
      setError('Please enter your name and a Room ID.');
      alert("Please Enter Relevant info")
      return;
    }
    setError('');
    setIsInRoom(true);
    navigate(`/room/${roomId}`)
  };



  const handleGenerateRoomId = () => {
    const newRoomId = `room-${Math.random().toString(36).substr(2, 6)}`;
    setRoomId(newRoomId);
  };

  return (
    <div className="antialiased bg-black text-white font-sans w-screen h-screen ">
      <BGGrid />

      <Lobby
        username={username}
        setUsername={setUsername}
        roomId={roomId}
        setRoomId={setRoomId}
        error={error}
        onJoin={handleJoinRoom}
        onGenerateRoomId={handleGenerateRoomId}
      />
    </div>
  );
}

export default App;


const Lobby: FC<LobbyProps> = ({ username, setUsername, roomId, setRoomId, error, onJoin, onGenerateRoomId }) => {

  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const getCameraPreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing camera for preview:", error
        );

      }
    }

    getCameraPreview();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    }
  }, [])


  return (
    <div className="flex items-center justify-center min-h-screen bg-grid-gray-900/20 p-4 h-screen w-screen bg-black">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left Side: Video Preview & Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="w-full max-w-md bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-auto aspect-video object-cover"></video>
          </div>
          <div className="mt-6">
            <h1 className="text-4xl font-bold tracking-tight text-white">VideoMeet</h1>
            <p className="text-gray-400 mt-2">High-quality video calls, simple and secure.</p>
          </div>
        </div>

        {/* Right Side: Join Form */}
        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 p-8 rounded-2xl shadow-lg">
          <h2 className="text-2xl font-bold mb-6 text-center">Join a Room</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Your Name</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-500"
                placeholder="Enter your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Room ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="flex-grow px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-500"
                  placeholder="Enter or generate a Room ID"
                />
                <button
                  onClick={onGenerateRoomId}
                  className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center"
                  title="Generate new Room ID"
                >
                  <Settings size={20} />
                </button>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              onClick={onJoin}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-lg"
            >
              Join Room <ChevronRight size={22} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper for background grid pattern
const BGGrid: FC = () => (
  <style>
    {`
      .bg-grid-gray-900\\/20 {
        background-image: linear-gradient(to right, rgba(55, 65, 81, 0.2) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(55, 65, 81, 0.2) 1px, transparent 1px);
        background-size: 2.5rem 2.5rem;
      }
    `}
  </style>
);
