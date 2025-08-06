import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import VideoMeeting from './pages/VideoMeeting';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="w-screen h-screen bg-black">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/room/:roomId"
            element={
              <VideoMeeting
                username="Guest"
                roomId={window.location.pathname.split('/room/')[1] || ''}
                onLeave={() => window.location.replace('/')}
              />
            }
          />
          <Route path="*" element={
            <div className="flex items-center justify-center h-screen text-white">
              404 Not Found
            </div>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;