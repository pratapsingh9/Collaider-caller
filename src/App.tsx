import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.tsx';
import VideoMeeting from './pages/VideoMeeting.tsx';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="w-screen h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<VideoMeeting />} />
          <Route path="*" element={<div className="flex items-center justify-center h-screen text-white">404 Not Found</div>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;