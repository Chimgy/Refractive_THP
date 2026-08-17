import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import UsagePage from './pages/UsagePage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/usage" element={<UsagePage />} />
        <Route path="*" element={<Navigate to="/usage" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
