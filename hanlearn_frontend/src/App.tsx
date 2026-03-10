import { Navigate, Route, Routes } from 'react-router-dom'
import { AnalyzePage } from './pages/AnalyzePage'
import { LandingPage } from './pages/LandingPage'
import { PastePage } from './pages/PastePage'
import { UploadPage } from './pages/UploadPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/paste" element={<PastePage />} />
      <Route path="/analyze" element={<AnalyzePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
